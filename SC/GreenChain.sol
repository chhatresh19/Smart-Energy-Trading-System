// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GreenChain {
    struct Listing {
        uint256 id;
        address payable seller;
        uint256 kwh;
        uint256 pricePerKwhWei; // Stored in Wei for precise calculation
        bool active;
    }

    mapping(uint256 => Listing) public listings;
    uint256 public listingCount;

    event EnergyListed(uint256 indexed id, address indexed seller, uint256 kwh, uint256 pricePerKwhWei);
    event EnergyPurchased(uint256 indexed id, address indexed buyer, uint256 kwhToBuy, uint256 totalCost);

    // 1. List surplus renewable energy
    function listEnergy(uint256 _kwh, uint256 _pricePerKwhWei) public {
        require(_kwh > 0, "Energy amount must be greater than zero");
        require(_pricePerKwhWei > 0, "Price must be greater than zero");

        listingCount++;
        listings[listingCount] = Listing({
            id: listingCount,
            seller: payable(msg.sender),
            kwh: _kwh,
            pricePerKwhWei: _pricePerKwhWei,
            active: true
        });

        emit EnergyListed(listingCount, msg.sender, _kwh, _pricePerKwhWei);
    }

    // 2. Buy energy and transfer funds to the seller
    function buyEnergy(uint256 _id, uint256 _kwhToBuy) public payable {
        Listing storage listing = listings[_id];
        
        require(listing.active, "This listing is no longer active");
        require(_kwhToBuy > 0 && _kwhToBuy <= listing.kwh, "Invalid kWh amount requested");

        uint256 totalCost = _kwhToBuy * listing.pricePerKwhWei;
        require(msg.value >= totalCost, "Insufficient funds sent for this purchase");

        // Update remaining energy
        listing.kwh -= _kwhToBuy;
        if (listing.kwh == 0) {
            listing.active = false;
        }

        // Transfer funds directly to the producer/seller
        listing.seller.transfer(totalCost);

        // Refund any excess payment sent by the buyer
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }

        emit EnergyPurchased(_id, msg.sender, _kwhToBuy, totalCost);
    }
}