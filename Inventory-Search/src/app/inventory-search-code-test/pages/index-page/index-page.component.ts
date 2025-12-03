// pages/index-page/index-page.component.ts

// TypeScript
import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {BehaviorSubject, merge, Subject} from 'rxjs';
import {debounceTime, filter, map, shareReplay, startWith, switchMap, takeUntil, tap} from 'rxjs/operators';
import {InventoryItem, InventorySearchQuery, SearchBy,} from '../../models/inventory-search.models';
import {InventorySearchApiService} from '../../services/inventory-search-api.service';
import { InjectionToken, Inject, OnInit, Optional, ElementRef, ViewChild } from '@angular/core';
import { finalize } from 'rxjs/operators';

type SortDir = 'asc' | 'desc';
interface SortState { field: keyof InventoryItem | ''; direction: SortDir; }

// Configurable debounce for searches (defaults to 50ms)
export const INVENTORY_SEARCH_DEBOUNCE_MS = new InjectionToken<number>('INVENTORY_SEARCH_DEBOUNCE_MS');

@Component({
  selector: 'inv-index-page',
  templateUrl: './index-page.component.html',
  styleUrls: ['./index-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class IndexPageComponent implements OnDestroy, OnInit {
  /**
   * Challenge hint (replace this block with your state fields):
   * - Define reactive controllers for: search trigger, sort state, and current page.
   * - Expose public observables for: total count and items list derived from responses.
   * - Track loading as a boolean BehaviorSubject toggled around requests.
   * - Keep a simple string errorMessage to show failures inline.
   * - Keep a configurable debounce value (overridable via DI) for throttling user actions.
   * - Create a form group with fields for criteria, by, branches, and onlyAvailable.
   */
  // (Implement fields here)

  // Reactive form built up-front for criteria/by/branches/availability
  form!: ReturnType<FormBuilder['group']>;
  readonly pageSize = 20;
  readonly branches = ['SEA', 'PDX', 'SFO', 'LAX', 'DEN', 'PHX', 'DAL', 'ORD', 'ATL', 'JFK'];
  readonly byOptions: Array<{ label: string; value: SearchBy }> = [
    { label: 'Part Number', value: 'PartNumber' },
    { label: 'Description', value: 'Description' },
    { label: 'Supplier SKU', value: 'SupplierSKU' },
  ];

  // Dropdown UI state for custom branch selector
  branchListOpen = false;
  @ViewChild('branchContainer') branchContainer?: ElementRef<HTMLElement>;

  // UI streams required by skeleton: loading/items/total, error string, paging
  loading$ = new BehaviorSubject<boolean>(false);
  items$ = new BehaviorSubject<InventoryItem[]>([]);
  total$ = new BehaviorSubject<number>(0);
  errorMessage: string | null = null;
  currentPage = 0;

  // Triggers for search pipeline (search button, sort, pagination)
  private readonly searchTrigger$ = new Subject<void>();
  private readonly sortState$ = new BehaviorSubject<SortState>({ field: '', direction: 'asc' });
  private readonly page$ = new BehaviorSubject<number>(0);
  private readonly destroy$ = new Subject<void>();
  private _debounce = 50;


  constructor(
    private readonly fb: FormBuilder,
    private readonly api: InventorySearchApiService,
    @Inject(INVENTORY_SEARCH_DEBOUNCE_MS) @Optional() debounceMs: number | null
  ) {
    if (typeof debounceMs === 'number') {
      this._debounce = debounceMs;
    }
    this.form = this.fb.group({
      criteria: ['', Validators.required],
      by: ['PartNumber' as SearchBy, Validators.required],
      branches: [[] as string[]],
      onlyAvailable: [false],
    });
  }

  /**
   * Code challenge – high-level goal:
   * - Compose a reactive search pipeline driven by three inputs: manual search trigger, sort changes, and page changes.
   * - Debounce and transform those inputs into a typed query object, then execute the request while canceling stale ones.
   * - Expose loading, total count, and items as observables suitable for OnPush + async pipe.
   * - Handle failures with a simple inline message; keep all UI state separate from API concerns.
   * - Ensure proper cleanup of subscriptions and efficient re-use of the latest emissions.
   */

  ngOnInit(): void {
    // Compose merged search pipeline: search trigger + sort + paging
    const response$ = merge(
      this.searchTrigger$,
      this.sortState$,
      this.page$
    ).pipe(
      debounceTime(this._debounce),
      map(() => this.buildQuery()),
      filter((q): q is InventorySearchQuery => !!q),
      tap(() => {
        this.errorMessage = null;
        this.loading$.next(true);
      }),
      switchMap(q =>
        this.api.search(q).pipe(
          tap(res => {
            if (res.isFailed) {
              this.errorMessage = res.message || 'Search failed';
            } else {
              this.errorMessage = null;
            }
          }),
          finalize(() => this.loading$.next(false))
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
      takeUntil(this.destroy$)
    );

    // Split out items/total streams for async pipe consumption
    response$
      .pipe(map(res => (res.isFailed || !res.data ? [] : res.data.items)))
      .subscribe(items => this.items$.next(items));

    response$
      .pipe(
        map(res => (res.isFailed || !res.data ? 0 : res.data.total)),
        startWith(0)
      )
      .subscribe(total => this.total$.next(total));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.loading$.complete();
    this.items$.complete();
    this.total$.complete();
  }

  onSearch() {
 // implement the search
  }

  onEnterKey() {
    // basic debounce handled on query$ level; just trigger search
    this.onSearch();
  }

  onSort(field: keyof InventoryItem) {
  // implement the sort functionality
  }

  onPageChange(pageIndex: number) {
// implement the required code
  }
  // Handle branches input changes from template
  onBranchesChange(event: Event) {
// implement the code
  }

  // Build the query
  private buildQuery(): InventorySearchQuery {
// implement the code
  }

  protected readonly String = String;
}
