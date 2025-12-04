using InventoryServer.Models;
using System.Threading.Tasks;

namespace InventoryServer.Services
{

    public interface IInventoryService
    {
        Task<SearchResult> SearchInventoryAsync(InventorySearchRequest request);
        Task<AvailabilityResult> GetPeakAvailabilityAsync(string partNumber);
    }
}
