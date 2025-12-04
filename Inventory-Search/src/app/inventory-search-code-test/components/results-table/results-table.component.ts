//components/results-table/results-table.component.ts

// TypeScript
import {ChangeDetectionStrategy, Component, EventEmitter, Input, Output, ChangeDetectorRef} from '@angular/core';
import {InventoryItem, InventoryItemSortableFields, PeakAvailability} from '../../models/inventory-search.models';
import { InventorySearchApiService } from '../../services/inventory-search-api.service';
import { finalize } from 'rxjs/operators';


@Component({
  selector: 'inventory-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: false
})
export class ResultsTableComponent {
  @Input() items: InventoryItem[] | null = [];
  @Input() total = 0;
  @Input() pageSize = 20;

  @Output() sort = new EventEmitter<InventoryItemSortableFields>();
  @Output() pageChange = new EventEmitter<number>();

  pageIndex = 0;
  expanded: Record<string, boolean> = {};
  selectedTab: Record<string, 'lots' | 'peak'> = {};
  // Added: keep per-part peak availability and loading state
  peakLoading: Record<string, boolean> = {};
  peakByPart: Record<string, PeakAvailability | null> = {};
  // Simple inline error message
  errorMessage: string | null = null;
  currentSort: { field: InventoryItemSortableFields; direction: 'asc' | 'desc' } | null = null;


  headers: Array<{ label: string; field: InventoryItemSortableFields; sortable?: boolean } | { label: string; field: keyof InventoryItem; sortable?: boolean }> = [
    { label: 'Part Number', field: 'partNumber', sortable: true},
    { label: 'Supplier SKU', field: 'supplierSku', sortable: false },
    { label: 'Description', field: 'description', sortable: true },
    { label: 'Branch', field: 'branch', sortable: true },
    { label: 'Available', field: 'availableQty', sortable: true },
    { label: 'UOM', field: 'uom', sortable: true },
    { label: 'Lead Time (days)', field: 'leadTimeDays', sortable: true },
    { label: 'Last Purchase', field: 'lastPurchaseDate', sortable: true },
  ];

  constructor(
    private readonly api: InventorySearchApiService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  onHeaderClick(field: InventoryItemSortableFields) {
    // Toggle sort direction or set new sort field
    if (this.currentSort?.field === field) {
      this.currentSort = {
        field,
        direction: this.currentSort.direction === 'asc' ? 'desc' : 'asc'
      };
    } else {
      this.currentSort = { field, direction: 'asc' };
    }
    this.pageIndex = 0;
    this.sort.emit(field);
  }

  toggleExpand(item: InventoryItem) {
    // Toggle expanded state for the given item
    const key = this.rowKey(item);
    this.expanded[key] = !this.expanded[key];
    if (this.expanded[key] && !this.selectedTab[key]) {
      this.selectedTab[key] = 'lots';
    }
  }


  // Fetch peak availability for a given item/part
  fetchPeakAvailability(item: InventoryItem) {
    const key = item.partNumber;
    if (this.peakLoading[key]) return;
    this.peakLoading = { ...this.peakLoading, [key]: true };
    this.errorMessage = null;

    this.api.getPeakAvailability(item.partNumber)
      .pipe(finalize(() => {
        this.peakLoading = { ...this.peakLoading, [key]: false };
        this.cdr.markForCheck();
      }))
      .subscribe({
        next: res => {
          if (res.isFailed || !res.data) {
            this.errorMessage = `Failed to load peak availability${res.message ? ': ' + res.message : ''}`;
            this.peakByPart = { ...this.peakByPart, [key]: null };
            this.cdr.markForCheck();
            return;
          }
          this.peakByPart = { ...this.peakByPart, [key]: res.data };
          this.cdr.markForCheck();
        },
        error: err => {
          this.errorMessage = 'Failed to load peak availability';
          this.peakByPart = { ...this.peakByPart, [key]: null };
          this.cdr.markForCheck();
        }
      });
  }

  selectTab(item: InventoryItem, tab: 'lots' | 'peak') {
    const key = this.rowKey(item);
    this.selectedTab[key] = tab;
    if (tab === 'peak' && !this.peakByPart[item.partNumber] && !this.peakLoading[item.partNumber]) {
      this.fetchPeakAvailability(item);
    }
  }

  totalPages(total: number, size: number) {
    return Math.max(1, Math.ceil((total ?? 0) / (size || 1)));
  }

  goTo(page: number) {
    const maxPage = this.totalPages(this.total, this.pageSize) - 1;
    this.pageIndex = Math.min(Math.max(0, page), maxPage);
    this.pageChange.emit(this.pageIndex);
  }

  // Unique key for each row based on part number and branch
  rowKey(item: InventoryItem) {
    return `${item.partNumber}_${item.branch}`;
  }

  // Type guard for sortable headers
  isSortableHeader(
    h: { field: InventoryItemSortableFields; sortable?: boolean } | { field: keyof InventoryItem; sortable?: boolean }
  ): h is { field: InventoryItemSortableFields; sortable?: boolean } {
    return !!h.sortable && typeof h.field === 'string';
  }
}
