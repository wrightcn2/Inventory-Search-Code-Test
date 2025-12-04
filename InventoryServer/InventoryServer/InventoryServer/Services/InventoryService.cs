
using InventoryServer.Models;
using InventoryServer.Repositories;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace InventoryServer.Services
{
    public class InventoryService : IInventoryService
    {
        private readonly IInventoryRepository _repository;
        public InventoryService(IInventoryRepository repository, IConfiguration configuration)
        {
            _repository = repository ?? throw new ArgumentNullException(nameof(repository));
        }

        public async Task<SearchResult> SearchInventoryAsync(InventorySearchRequest request)
        {
            if (request == null) throw new ArgumentNullException(nameof(request));
            var all = await _repository.GetAllItemsAsync();

            IEnumerable<InventoryItem> query = all;

            var criteria = (request.Criteria ?? string.Empty).Trim();
            var by = (request.By ?? "PartNumber").Trim();
            if (!string.IsNullOrWhiteSpace(criteria))
            {
                var critUpper = criteria.ToUpperInvariant();
                query = by switch
                {
                    "Description" => query.Where(i => (i.Description ?? string.Empty).ToUpperInvariant().Contains(critUpper)),
                    "SupplierSKU" => query.Where(i => (i.SupplierSku ?? string.Empty).ToUpperInvariant().Contains(critUpper)),
                    _ => query.Where(i => (i.PartNumber ?? string.Empty).ToUpperInvariant().Contains(critUpper)),
                };
            }

            if (!string.IsNullOrWhiteSpace(request.Branches))
            {
                var branchSet = request.Branches
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .Select(b => b.ToUpperInvariant())
                    .ToHashSet();
                query = query.Where(i => branchSet.Contains((i.Branch ?? string.Empty).ToUpperInvariant()));
            }

            if (request.OnlyAvailable)
            {
                query = query.Where(i => i.AvailableQty > 0);
            }

            // Sorting
            var sortField = "partNumber";
            var sortDir = "asc";
            if (!string.IsNullOrWhiteSpace(request.Sort) && request.Sort.Contains(':'))
            {
                var parts = request.Sort.Split(':', StringSplitOptions.TrimEntries);
                sortField = parts[0].ToLowerInvariant();
                sortDir = parts.Length > 1 ? parts[1].ToLowerInvariant() : "asc";
            }

            Func<InventoryItem, object> keySelector = sortField switch
            {
                "description" => i => i.Description ?? string.Empty,
                "branch" => i => i.Branch ?? string.Empty,
                "availableqty" => i => i.AvailableQty,
                "uom" => i => i.Uom ?? string.Empty,
                "leadtimedays" => i => i.LeadTimeDays ?? int.MaxValue,
                "lastpurchasedate" => i => i.LastPurchaseDate ?? DateTime.MinValue,
                _ => i => i.PartNumber ?? string.Empty
            };

            query = sortDir == "desc" ? query.OrderByDescending(keySelector) : query.OrderBy(keySelector);

            var total = query.Count();
            var size = request.Size <= 0 ? 20 : request.Size;
            var page = request.Page < 0 ? 0 : request.Page;
            var items = query.Skip(page * size).Take(size).ToList();

            return new SearchResult
            {
                Total = total,
                Items = items
            };
        }

        public async Task<AvailabilityResult> GetPeakAvailabilityAsync(string partNumber)
        {
            if (string.IsNullOrWhiteSpace(partNumber))
                throw new ArgumentException("partNumber is required", nameof(partNumber));

            var matches = await _repository.FindByPartNumberAsync(partNumber);
            if (!matches.Any())
            {
                return new AvailabilityResult
                {
                    PartNumber = partNumber.Trim(),
                    TotalAvailable = 0,
                    Branches = new List<BranchAvailability>()
                };
            }

            var grouped = matches
                .GroupBy(i => (i.Branch ?? string.Empty).ToUpperInvariant())
                .Select(g => new BranchAvailability
                {
                    Branch = g.Key,
                    Qty = g.Sum(x => x.AvailableQty)
                })
                .OrderByDescending(b => b.Qty)
                .ToList();

            return new AvailabilityResult
            {
                PartNumber = matches.First().PartNumber,
                TotalAvailable = grouped.Sum(b => b.Qty),
                Branches = grouped
            };
        }

    }
}
