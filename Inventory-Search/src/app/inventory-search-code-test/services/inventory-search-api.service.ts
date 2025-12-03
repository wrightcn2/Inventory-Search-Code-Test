//services/inventory-search-api.service.ts

// TypeScript
import {HttpClient, HttpParams} from '@angular/common/http';
import {Inject, Injectable, InjectionToken} from '@angular/core';
import {Observable} from 'rxjs';
import {shareReplay, tap} from 'rxjs/operators';
import {
  ApiEnvelope,
  InventorySearchQuery,
  PagedInventoryResponse,
  PeakAvailability,
} from '../models/inventory-search.models';

export const INVENTORY_API_BASE = new InjectionToken<string>('INVENTORY_API_BASE');

// TTL 60s, keep up to 5 cached queries
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 5;

interface CacheEntry<T> {
  key: string;
  expiry: number;
  obs$: Observable<T>;
}

@Injectable({ providedIn: 'root' })
export class InventorySearchApiService {
  private cache: CacheEntry<ApiEnvelope<PagedInventoryResponse>>[] = [];
  private peakCache: CacheEntry<ApiEnvelope<PeakAvailability>>[] = [];

  constructor(
    private readonly http: HttpClient,
    @Inject(INVENTORY_API_BASE) private readonly baseUrl: string
  ) {}

  search(query: InventorySearchQuery): Observable<ApiEnvelope<PagedInventoryResponse>> {

    /**
     * Challenge hint:
     * - Derive a stable cache key from the query (include all fields that affect results).
     * - Keep a small in-memory cache with expiration; reuse in-flight/completed observables.
     * - Translate the query into HTTP params; include optional fields only when present.
     * - Return a shared observable so multiple subscribers don’t duplicate requests.
     * - Avoid mixing UI concerns; this layer should only compose and return data streams.
     *
     * this.http.get<??????>(`${this.baseUrl}/inventory/search`, { params })
     */

    //build cache key and evict stale entries
    const key = this.cacheKey(query);
    const now = Date.now();
    this.cache = this.cache.filter(e => e.expiry > now);

    const hit = this.cache.find(e => e.key === key);
    if (hit) return hit.obs$;

    //build HttpParams
    let params = new HttpParams()
      .set('criteria', query.criteria.trim())
      .set('by', query.by)
      .set('onlyAvailable', String(!!query.onlyAvailable))
      .set('page', String(query.page))
      .set('size', String(query.size));

    if (query.branches?.length) {
      params = params.set('branches', query.branches.join(','));
    }
    if (query.sort?.field) {
      params = params.set('sort', `${query.sort.field}:${query.sort.direction}`);
    }

    const obs$ = this.http.get<ApiEnvelope<PagedInventoryResponse>>(
      `${this.baseUrl}/inventory/search`,
      { params }
    ).pipe(
      tap(res => {
        if (res.isFailed) {
          // drop failed responses so callers can retry
          this.cache = this.cache.filter(e => e.key !== key);
        }
      }),
      //sharereplay for mutlicast + caching
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // remember in cache
    this.remember(this.cache, { key, obs$ });
    return obs$;
  }

  getPeakAvailability(partNumber: string): Observable<ApiEnvelope<PeakAvailability>> {
    /**
     * Challenge hint:
     * - Use the part number to form a cache key for this lookup.
     * - Evict stale entries before attempting a cache hit.
     * - If cached, return the shared observable to avoid duplicate requests.
     * - Otherwise, issue a GET with the partNumber as a query param and share the result.
     * - Remember the observable with a TTL (time to live); keep this method free of UI concerns.
     * this.http.get<??????>(`${this.baseUrl}/inventory/availability/peak`, { params})
     */

    //build cache key and evict stale entries
    const key = `peak:${partNumber.trim().toUpperCase()}`;
    const now = Date.now();
    this.peakCache = this.peakCache.filter(e => e.expiry > now);

    //check for cache hit
    const hit = this.peakCache.find(e => e.key === key);
    if (hit) return hit.obs$;

    //build HttpParams
    const params = new HttpParams().set('partNumber', partNumber.trim());
    const obs$ = this.http.get<ApiEnvelope<PeakAvailability>>(
      `${this.baseUrl}/inventory/availability/peak`,
      { params }
    ).pipe(
      tap(res => {
        if (res.isFailed) {
          this.peakCache = this.peakCache.filter(e => e.key !== key);
        }
      }),
      //sharereplay for mutlicast + caching
      shareReplay({ bufferSize: 1, refCount: true })
    );

    // remember in cache
    this.remember(this.peakCache, { key, obs$ });
    return obs$;
  }

  /**
   * Challenge hint:
   * - Keep the cache small and predictable; decide what to evict when full.
   * - Consider how expiration (TTL) interacts with capacity-based eviction.
   * - Think about whether failed results should be cached the same way as successful ones.
   * - Keep this purely about data/memoization; avoid UI/side-effects here.
   */

  private remember<T>(
    cache: CacheEntry<T>[],
    entry: { key: string; obs$: Observable<T> }
  ) {

    // Set expiry time
    const expiry = Date.now() + CACHE_TTL_MS;
    // Remove expired first
    let next = cache.filter(c => c.expiry > Date.now());
    // If at capacity, evict the oldest
    if (next.length >= CACHE_MAX_ENTRIES) {
      next = next
        .sort((a, b) => a.expiry - b.expiry)
        .slice(next.length - CACHE_MAX_ENTRIES + 1);
    }
    // Add new entry
    next.push({ ...entry, expiry });
    while (next.length > CACHE_MAX_ENTRIES) {
      next.shift();
    }
    // Assign back to the correct cache
    if (cache === this.cache) {
      this.cache = next as CacheEntry<ApiEnvelope<PagedInventoryResponse>>[];
    } else {
      this.peakCache = next as CacheEntry<ApiEnvelope<PeakAvailability>>[];
    }

  }
  /**
   * Challenge hint:
   * - Produce a stable key that uniquely represents the query.
   * - Normalize values (e.g., trim, lowercase) to avoid duplicate keys for equivalent inputs.
   * - Ensure ordering doesn’t affect the key (e.g., sort arrays like branches).
   * - Include every parameter that can change results; omit those that do not.
   * - Choose delimiters that won’t collide with real data.
   */

  private cacheKey(q: InventorySearchQuery): string {
    // Normalize and build a unique key string
    const criteria = q.criteria.trim().toLowerCase();
    const by = q.by;
    const branches = [...(q.branches || [])]
      .map(b => b.trim().toUpperCase())
      .sort()
      .join('|');
    const available = q.onlyAvailable ? '1' : '0';
    const page = `p${q.page}`;
    const size = `s${q.size}`;
    const sort = q.sort?.field
      ? `${q.sort.field}:${q.sort.direction}`
      : 'nosort';
    return [criteria, by, branches, available, page, size, sort].join('::');
  }
}
