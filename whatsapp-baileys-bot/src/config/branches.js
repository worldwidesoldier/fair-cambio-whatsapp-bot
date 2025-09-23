module.exports = {
  "branches": [
    {
      "id": "1",
      "name": "Fair Câmbio - São José",
      "phone": "(48) 9969-72142",
      "address": "Av. Presidente Kennedy, 1953 - Campinas, São José - SC, 88102-401",
      "hours": {
        "weekdays": "09:00 - 17:30",
        "saturday": "Fechado",
        "sunday": "Fechado"
      },
      "maps": "https://maps.google.com/maps?q=-27.5954,-48.5480",
      "googleMapsLink": "https://maps.google.com/maps?q=-27.5954,-48.5480",
      "active": true,
      "priority": 1,
      "region": "centro",
      "manager": "João Silva",
      "email": "saojose@faircambio.com.br",
      "features": [
        "exchange",
        "remittance",
        "cards",
        "consultation"
      ],
      "maxConnections": 50,
      "autoRestart": true,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 5000
      },
      "notifications": {
        "startup": true,
        "shutdown": true,
        "errors": true
      }
    },
    {
      "id": "2",
      "name": "Fair Câmbio - Balneário Camboriú",
      "phone": "(47) 9928-72777",
      "address": "Av. Brasil, 1615 - Sala 22 - Centro, Balneário Camboriú - SC, 88330-048",
      "hours": {
        "weekdays": "09:00 - 17:00",
        "saturday": "09:00 - 12:00",
        "sunday": "Fechado"
      },
      "maps": "https://maps.google.com/maps?q=-27.0006,-48.6262",
      "googleMapsLink": "https://maps.google.com/maps?q=-27.0006,-48.6262",
      "active": true,
      "priority": 2,
      "region": "zona-centro",
      "manager": "Maria Santos",
      "email": "bc@faircambio.com.br",
      "features": [
        "exchange",
        "consultation",
        "cards"
      ],
      "maxConnections": 30,
      "autoRestart": true,
      "healthCheck": {
        "enabled": true,
        "interval": 45000,
        "timeout": 8000
      },
      "notifications": {
        "startup": true,
        "shutdown": true,
        "errors": true
      }
    },
    {
      "id": "3",
      "name": "Fair Câmbio - Bombinhas",
      "phone": "(47) 9998-12517",
      "address": "Av. Leopoldo Zarling, 1221 - Bombas, Bombinhas - SC, 88215-000",
      "hours": {
        "weekdays": "09:00 - 17:00",
        "saturday": "Fechado",
        "sunday": "Fechado"
      },
      "maps": "https://maps.google.com/maps?q=-27.1486,-48.4814",
      "googleMapsLink": "https://maps.google.com/maps?q=-27.1486,-48.4814",
      "active": true,
      "priority": 3,
      "region": "zona-litoral",
      "manager": "Carlos Oliveira",
      "email": "bombinhas@faircambio.com.br",
      "features": [
        "exchange",
        "remittance",
        "consultation"
      ],
      "maxConnections": 40,
      "autoRestart": true,
      "healthCheck": {
        "enabled": true,
        "interval": 30000,
        "timeout": 6000
      },
      "notifications": {
        "startup": true,
        "shutdown": true,
        "errors": true
      }
    },
    {
      "id": "4",
      "name": "Fair Câmbio - Brusque",
      "phone": "(47) 9913-90101",
      "address": "Rua Centro, 100 - Centro, Brusque - SC, 88350-000",
      "hours": {
        "weekdays": "09:00 - 17:00",
        "saturday": "Fechado",
        "sunday": "Fechado"
      },
      "maps": "https://maps.google.com/maps?q=-27.0981,-48.9158",
      "googleMapsLink": "https://maps.google.com/maps?q=-27.0981,-48.9158",
      "active": true,
      "priority": 4,
      "region": "zona-vale",
      "manager": "Ana Costa",
      "email": "brusque@faircambio.com.br",
      "features": [
        "exchange",
        "consultation",
        "cards"
      ],
      "maxConnections": 25,
      "autoRestart": true,
      "healthCheck": {
        "enabled": true,
        "interval": 60000,
        "timeout": 10000
      },
      "notifications": {
        "startup": true,
        "shutdown": true,
        "errors": true
      }
    },
    {
      "id": "5",
      "name": "Fair Câmbio - Criciúma",
      "phone": "(48) 9985-65822",
      "address": "R. Cel. Pedro Benedet, 190 - Centro, Criciúma - SC, 88801-250",
      "hours": {
        "weekdays": "09:00 - 17:00",
        "saturday": "Fechado",
        "sunday": "Fechado"
      },
      "maps": "https://maps.google.com/maps?q=-28.6774,-49.3695",
      "googleMapsLink": "https://maps.google.com/maps?q=-28.6774,-49.3695",
      "active": true,
      "priority": 5,
      "region": "zona-sul",
      "manager": "Roberto Lima",
      "email": "criciuma@faircambio.com.br",
      "features": [
        "exchange",
        "consultation",
        "cards"
      ],
      "maxConnections": 25,
      "autoRestart": true,
      "healthCheck": {
        "enabled": true,
        "interval": 60000,
        "timeout": 10000
      },
      "notifications": {
        "startup": true,
        "shutdown": true,
        "errors": true
      }
    }
  ]
};

// Add all the methods back
Object.assign(module.exports, {
  getActiveBranches() {
    return this.branches.filter(b => b.active);
  },
  getBranchByPhone(phone) {
    return this.branches.find(b => b.phone === phone);
  },
  getBranchById(id) {
    return this.branches.find(b => b.id === id);
  },
  getBranchesByRegion(region) {
    return this.branches.filter(b => b.region === region);
  },
  getBranchesByPriority() {
    return this.branches.sort((a, b) => a.priority - b.priority);
  },
  getBranchByFeature(feature) {
    return this.branches.filter(b => b.features.includes(feature));
  },
  getAllLocations() {
    return this.branches.map(b => ({
      id: b.id,
      name: b.name,
      address: b.address,
      hours: b.hours,
      maps: b.maps,
      region: b.region,
      manager: b.manager,
      active: b.active
    }));
  }
});