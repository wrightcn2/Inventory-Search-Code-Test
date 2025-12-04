using InventoryServer.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

// TODO Implement the required code
/*
You are free to determine how you want to create data to be returned 
Feel free to modify and/or expand the Interface as needed 
Must have at least enough data to demonstrate paging (4 or more pages)
*/
namespace InventoryServer.Repositories
{
    public class MockInventoryRepository : IInventoryRepository
    {
        // Seeded mock dataset to support paging, sorting, search and peak aggregation
        private readonly List<InventoryItem> _items = new();

        public MockInventoryRepository()
        {
            var branches = new[] { "SEA", "PDX", "SFO", "LAX", "DEN", "DAL", "ORD", "ATL", "JFK" };
            var uoms = new[] { "EA", "BX", "CS" };
            var rng = new Random(1234);
            int partIndex = 0;

            for (int i = 0; i < 60; i++)
            {
                var partNumber = $"PN-{1000 + partIndex}";
                var supplierSku = $"SUP-{5000 + partIndex}";
                var description = $"Mock part {partIndex} - {((i % 2 == 0) ? "standard" : "premium")}";
                var branch = branches[i % branches.Length];
                var available = rng.Next(0, 600);
                var lead = rng.Next(0, 2) == 0 ? (int?)rng.Next(1, 30) : null;
                var lastPurchase = rng.Next(0, 2) == 0 ? DateTime.UtcNow.AddDays(-rng.Next(5, 200)) : (DateTime?)null;

                var lots = new List<LotInfo>();
                var lotCount = rng.Next(0, 3);
                for (int l = 0; l < lotCount; l++)
                {
                    lots.Add(new LotInfo
                    {
                        LotNumber = $"LOT-{partIndex}-{l}",
                        Qty = rng.Next(1, 150),
                        ExpirationDate = rng.Next(0, 2) == 0 ? (DateTime?)DateTime.UtcNow.AddDays(rng.Next(30, 365)) : null
                    });
                }

                _items.Add(new InventoryItem
                {
                    PartNumber = partNumber,
                    SupplierSku = supplierSku,
                    Description = description,
                    Branch = branch,
                    AvailableQty = available,
                    Uom = uoms[i % uoms.Length],
                    LeadTimeDays = lead,
                    LastPurchaseDate = lastPurchase,
                    Lots = lots
                });

                if (i % 3 == 0) partIndex++;
            }
        }

        public Task<List<InventoryItem>> GetAllItemsAsync()
        {
            return Task.FromResult(_items.ToList());
        }

        public Task<List<InventoryItem>> FindByPartNumberAsync(string partNumber)
        {
            var normalized = (partNumber ?? string.Empty).Trim().ToUpperInvariant();
            var results = _items
                .Where(i => string.Equals(i.PartNumber?.Trim().ToUpperInvariant(), normalized, StringComparison.OrdinalIgnoreCase))
                .ToList();
            return Task.FromResult(results);
        }

    }
}
