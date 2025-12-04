// pages/index-page/index-page.component.ts

// TypeScript
import {ChangeDetectionStrategy, Component, OnDestroy} from '@angular/core';
import {FormBuilder, Validators} from '@angular/forms';
import {BehaviorSubject, merge, Subject} from 'rxjs';
import {debounceTime, filter, map, shareReplay, startWith, switchMap, takeUntil, tap} from 'rxjs/operators';
import {InventoryItem, InventoryItemSortableFields, InventorySearchQuery, SearchBy,} from '../../models/inventory-search.models';
import {InventorySearchApiService} from '../../services/inventory-search-api.service';
import { InjectionToken, Inject, OnInit, Optional, ElementRef, ViewChild, HostListener } from '@angular/core';
import { finalize } from 'rxjs/operators';

type SortDir = 'asc' | 'desc';
interface SortState { field: InventoryItemSortableFields | ''; direction: SortDir; }

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
      private readonly el: ElementRef<HTMLElement>,
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
    // Merge the three triggers into one search stream
    const response$ = merge(
      this.searchTrigger$,
      this.sortState$,
      this.page$
    ).pipe(
      this._debounce > 0 ? debounceTime(this._debounce) : tap(() => {}),
      //build the query from latest form/sort/page state
      map(() => this.buildQuery()),
      filter((q): q is InventorySearchQuery => !!q),
      //indicate loading state
      tap(() => {
        this.errorMessage = null;
        this.loading$.next(true);
      }),
      //switch to new search observable, canceling prior
      switchMap(q =>
        this.api.search(q).pipe(
          tap(res => {
            if (res.isFailed) {
              this.errorMessage = res.message || 'Search failed';
            } else {
              this.errorMessage = null;
            }
          }),
          finalize(() => this.loading$.next(false)) //turn off loading when done
        )
      ),
      shareReplay({ bufferSize: 1, refCount: true }),
      takeUntil(this.destroy$)
    );

    // Split out items and total from response
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
    if (this.form.invalid) {
      this.errorMessage = 'Enter search criteria to begin.';
      return;
    }
    // Immediately show loading before the reactive pipeline processes the trigger
    this.errorMessage = null;
    this.loading$.next(true);
    this.currentPage = 0;
    if (this.page$.value !== 0) {
      this.page$.next(0);
    }
    this.searchTrigger$.next();
  }

  onEnterKey() {
    // basic debounce handled on query$ level; just trigger search
    this.onSearch();
  }

  onSort(field: InventoryItemSortableFields) {
    const current = this.sortState$.value;
    const direction: SortDir =
      current.field === field && current.direction === 'asc' ? 'desc' : 'asc';
    this.sortState$.next({ field, direction });
    this.currentPage = 0;
    this.page$.next(0);
  }

  onPageChange(pageIndex: number) {
    this.currentPage = Math.max(0, pageIndex);
    this.page$.next(this.currentPage);
  }
  // Handle branches input changes from template
  // Using custom logic to manage array of selected branches
  onBranchesChange(branch: string, checked: boolean) {
    const current = new Set(this.form.value.branches || []);
    if (checked) { current.add(branch); }
    else { current.delete(branch); }
    this.form.patchValue({ branches: Array.from(current) });
  }
  // Toggle branch list dropdown
  toggleBranchList() {
    this.branchListOpen = !this.branchListOpen;
  }
  // Handle branch selection from dropdown
  onBranchSelect(branch: string) {
    const current = new Set(this.form.value.branches || []);
    if (current.has(branch)) { current.delete(branch); }
    else { current.add(branch); }
    this.form.patchValue({ branches: Array.from(current) });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    // Close dropdown when clicking outside the branch picker area
    if (!this.branchListOpen) return;
    const target = event.target as Node | null;
    if (target) {
      if (this.branchContainer?.nativeElement.contains(target)) {
        return;
      }
    }
    this.branchListOpen = false;
  }

  // Build the query
  private buildQuery(): InventorySearchQuery {
    const value = this.form.value;
    if (!value.criteria || this.form.invalid) {
      return null as any;
    }
    // Map form UI data into API query shape
    return {
      criteria: String(value.criteria).trim(),
      by: (value.by || 'PartNumber') as SearchBy,
      branches: (value.branches || []).map((b: string) => String(b).toUpperCase()),
      onlyAvailable: !!value.onlyAvailable,
      page: this.page$.value,
      size: this.pageSize,
      sort: this.sortState$.value.field
        ? {
            field: this.sortState$.value.field,
            direction: this.sortState$.value.direction
          }
        : undefined
    };
  }

  protected readonly String = String;
}
