using InventoryServer.Models;
using InventoryServer.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;

namespace InventoryServer.Controllers
{
    [Route("api/inventory")]
    [ApiController]
    public class InventoryController : ControllerBase
    {
        // DI-wired service and config to handle search and peak endpoints
        private readonly IInventoryService _inventoryService;
        private readonly IConfiguration _configuration;
        public InventoryController(IInventoryService inventoryService, IConfiguration configuration)
        {
            _inventoryService = inventoryService ?? throw new ArgumentNullException(nameof(inventoryService));
            _configuration = configuration;
        }

        [HttpGet("search")]
        public async Task<ActionResult<ResponseEnvelope<SearchResult>>> Search(
            [FromQuery] string criteria = "",
            [FromQuery] string by = "PartNumber",
            [FromQuery] string branches = "",
            [FromQuery] bool onlyAvailable = false,
            [FromQuery] int page = 0,
            [FromQuery] int size = 20,
            [FromQuery] string sort = "",
            [FromQuery] bool fail = false)
        {
            if (fail)
            {
                return BadRequest(ResponseEnvelope<SearchResult>.Failure("Forced failure (fail=true)"));
            }

            var request = new InventorySearchRequest
            {
                Criteria = criteria ?? string.Empty,
                By = string.IsNullOrWhiteSpace(by) ? "PartNumber" : by,
                Branches = branches ?? string.Empty,
                OnlyAvailable = onlyAvailable,
                Page = page,
                Size = size,
                Sort = sort ?? string.Empty
            };

            try
            {
                var result = await _inventoryService.SearchInventoryAsync(request);
                return Ok(ResponseEnvelope<SearchResult>.Success(result));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ResponseEnvelope<SearchResult>.Failure(ex.Message));
            }
        }

        [HttpGet("availability/peak")]
        public async Task<ActionResult<ResponseEnvelope<AvailabilityResult>>> GetPeakAvailability(
            [FromQuery] string partNumber)
        {
            if (string.IsNullOrWhiteSpace(partNumber))
            {
                return BadRequest(ResponseEnvelope<AvailabilityResult>.Failure("partNumber is required"));
            }

            try
            {
                var result = await _inventoryService.GetPeakAvailabilityAsync(partNumber);
                return Ok(ResponseEnvelope<AvailabilityResult>.Success(result));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ResponseEnvelope<AvailabilityResult>.Failure(ex.Message));
            }
        }

        [HttpGet("health")]
        public async Task<ActionResult<object>> Health()
        {
            await Task.CompletedTask;
            return Ok(new { status = "ok", env = _configuration?["ASPNETCORE_ENVIRONMENT"] ?? "Unknown" });
        }
    }
}
