using System.Linq;
using System.Threading.Tasks;
using InventoryServer.Models;
using InventoryServer.Repositories;
using InventoryServer.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace InventoryServer.Tests
{
    public class InventoryServiceTests
    {
        private readonly IInventoryService _service;

        public InventoryServiceTests()
        {
            var repo = new MockInventoryRepository();
            var config = new ConfigurationBuilder().Build();
            _service = new InventoryService(repo, config);
        }

        [Fact]
        public async Task SearchInventoryAsync_ReturnsPagedResults()
        {
            var request = new InventorySearchRequest
            {
                Criteria = "PN-",
                By = "PartNumber",
                Page = 0,
                Size = 10,
                Sort = "partNumber:asc"
            };

            var result = await _service.SearchInventoryAsync(request);

            Assert.NotNull(result);
            Assert.True(result.Total >= 20);
            Assert.Equal(10, result.Items.Count);
            Assert.True(result.Items.First().PartNumber.StartsWith("PN-"));
        }

        [Fact]
        public async Task GetPeakAvailabilityAsync_SumsBranches()
        {
            // take a known part number from the seeded data
            var request = new InventorySearchRequest { Criteria = "PN-1000", By = "PartNumber" };
            var search = await _service.SearchInventoryAsync(request);
            var partNumber = search.Items.First().PartNumber;

            var result = await _service.GetPeakAvailabilityAsync(partNumber);

            Assert.NotNull(result);
            Assert.Equal(partNumber, result.PartNumber);
            Assert.True(result.TotalAvailable >= result.Branches.Sum(b => b.Qty));
            Assert.True(result.Branches.Count > 0);
        }
    }
}
