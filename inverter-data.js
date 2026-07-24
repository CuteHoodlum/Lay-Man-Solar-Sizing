// ============================================
// SOLAR INVERTER DATABASE - GLOBAL BRANDS
// ============================================
// Comprehensive database of solar inverters from manufacturers worldwide
// Last updated: October 2025

const inverterDatabase = [
    // Huawei - China
    {brand: "Huawei", model: "SUN2000-2KTL-L1", type: "Hybrid", inputVoltage: [48, 96], outputVoltage: [230], kva: 2, efficiency: 97.6, country: "China"},
    {brand: "Huawei", model: "SUN2000-3KTL-L1", type: "Hybrid", inputVoltage: [48, 96], outputVoltage: [230], kva: 3, efficiency: 98.0, country: "China"},
    {brand: "Huawei", model: "SUN2000-5KTL-L1", type: "Hybrid", inputVoltage: [48, 96], outputVoltage: [230], kva: 5, efficiency: 98.2, country: "China"},
    {brand: "Huawei", model: "SUN2000-10KTL-M1", type: "Hybrid", inputVoltage: [96], outputVoltage: [230, 400], kva: 10, efficiency: 98.6, country: "China"},
    
    // Sungrow - China
    {brand: "Sungrow", model: "SH5RT", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 97.5, country: "China"},
    {brand: "Sungrow", model: "SH8RT", type: "Hybrid", inputVoltage: [48], outputVoltage: [230, 400], kva: 8, efficiency: 97.7, country: "China"},
    {brand: "Sungrow", model: "SH10RT", type: "Hybrid", inputVoltage: [48], outputVoltage: [230, 400], kva: 10, efficiency: 97.8, country: "China"},
    
    // SMA - Germany
    {brand: "SMA", model: "Sunny Boy 3.0", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [230], kva: 3, efficiency: 97.0, country: "Germany"},
    {brand: "SMA", model: "Sunny Island 4.4M", type: "Off-grid", inputVoltage: [48], outputVoltage: [230], kva: 4.4, efficiency: 95.0, country: "Germany"},
    {brand: "SMA", model: "Sunny Island 6.0H", type: "Off-grid", inputVoltage: [48], outputVoltage: [230], kva: 6, efficiency: 95.5, country: "Germany"},
    {brand: "SMA", model: "Sunny Island 8.0H", type: "Off-grid", inputVoltage: [48], outputVoltage: [230], kva: 8, efficiency: 96.0, country: "Germany"},
    
    // SolarEdge - Israel
    {brand: "SolarEdge", model: "SE3K", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [230], kva: 3, efficiency: 97.6, country: "Israel"},
    {brand: "SolarEdge", model: "SE5K", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [230], kva: 5, efficiency: 98.0, country: "Israel"},
    {brand: "SolarEdge", model: "SE10K", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [230, 400], kva: 10, efficiency: 98.3, country: "Israel"},
    
    // Growatt - China
    {brand: "Growatt", model: "SPF 3000TL", type: "Off-grid", inputVoltage: [24, 48], outputVoltage: [220, 230], kva: 3, efficiency: 93.0, country: "China"},
    {brand: "Growatt", model: "SPF 5000ES", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 97.0, country: "China"},
    {brand: "Growatt", model: "SPH 6000", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 6, efficiency: 97.8, country: "China"},
    {brand: "Growatt", model: "SPH 10000TL3 BH", type: "Hybrid", inputVoltage: [48], outputVoltage: [400], kva: 10, efficiency: 98.4, country: "China"},
    
    // GoodWe - China
    {brand: "GoodWe", model: "GW3048-EM", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 3, efficiency: 97.0, country: "China"},
    {brand: "GoodWe", model: "GW5048-EM", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 97.5, country: "China"},
    {brand: "GoodWe", model: "GW10K-ET", type: "Hybrid", inputVoltage: [48], outputVoltage: [400], kva: 10, efficiency: 98.0, country: "China"},
    
    // Victron Energy - Netherlands
    {brand: "Victron", model: "MultiPlus 12/1200", type: "Hybrid", inputVoltage: [12], outputVoltage: [230], kva: 1.2, efficiency: 93.0, country: "Netherlands"},
    {brand: "Victron", model: "MultiPlus 24/3000", type: "Hybrid", inputVoltage: [24], outputVoltage: [230], kva: 3, efficiency: 94.0, country: "Netherlands"},
    {brand: "Victron", model: "MultiPlus 48/5000", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 95.0, country: "Netherlands"},
    {brand: "Victron", model: "Quattro 48/10000", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 10, efficiency: 96.0, country: "Netherlands"},
    
    // Fronius - Austria
    {brand: "Fronius", model: "Primo 3.0-1", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [230], kva: 3, efficiency: 96.8, country: "Austria"},
    {brand: "Fronius", model: "Symo 5.0-3-M", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [400], kva: 5, efficiency: 97.9, country: "Austria"},
    {brand: "Fronius", model: "Symo 10.0-3-M", type: "Grid-tied", inputVoltage: [350, 480], outputVoltage: [400], kva: 10, efficiency: 98.0, country: "Austria"},
    
    // Deye - China
    {brand: "Deye", model: "SUN-3K-SG04LP3", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 3, efficiency: 97.6, country: "China"},
    {brand: "Deye", model: "SUN-5K-SG04LP3", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 97.8, country: "China"},
    {brand: "Deye", model: "SUN-8K-SG04LP3", type: "Hybrid", inputVoltage: [48], outputVoltage: [230, 400], kva: 8, efficiency: 98.4, country: "China"},
    {brand: "Deye", model: "SUN-12K-SG04LP3", type: "Hybrid", inputVoltage: [48], outputVoltage: [400], kva: 12, efficiency: 98.5, country: "China"},
    
    // SRNE - China
    {brand: "SRNE", model: "HBP800", type: "Off-grid", inputVoltage: [12, 24], outputVoltage: [220], kva: 0.8, efficiency: 88.0, country: "China"},
    {brand: "SRNE", model: "HBP1800", type: "Off-grid", inputVoltage: [24, 48], outputVoltage: [220], kva: 1.8, efficiency: 90.0, country: "China"},
    {brand: "SRNE", model: "HESP-3K6", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 3.6, efficiency: 93.0, country: "China"},
    {brand: "SRNE", model: "HESP-5K", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 94.0, country: "China"},
    
    // Delta - Taiwan
    {brand: "Delta", model: "M50A", type: "Grid-tied", inputVoltage: [600, 1000], outputVoltage: [400], kva: 50, efficiency: 98.7, country: "Taiwan"},
    {brand: "Delta", model: "M70A", type: "Grid-tied", inputVoltage: [600, 1000], outputVoltage: [400], kva: 70, efficiency: 98.8, country: "Taiwan"},
    {brand: "Delta", model: "M125HV", type: "Grid-tied", inputVoltage: [600, 1000], outputVoltage: [400], kva: 125, efficiency: 98.9, country: "Taiwan"},
    
    // Schneider Electric - France
    {brand: "Schneider", model: "Conext XW+ 5548", type: "Hybrid", inputVoltage: [48], outputVoltage: [230, 240], kva: 5.5, efficiency: 94.0, country: "France"},
    {brand: "Schneider", model: "Conext XW Pro 6848", type: "Hybrid", inputVoltage: [48], outputVoltage: [230, 240], kva: 6.8, efficiency: 95.0, country: "France"},
    
    // Sineng - China
    {brand: "Sineng", model: "EP-1000", type: "Grid-tied", inputVoltage: [600], outputVoltage: [400], kva: 100, efficiency: 98.8, country: "China"},
    
    // Luminous - India
    {brand: "Luminous", model: "Solar NXG 1100", type: "Off-grid", inputVoltage: [12], outputVoltage: [230], kva: 1.1, efficiency: 85.0, country: "India"},
    {brand: "Luminous", model: "Solar NXG 1800", type: "Hybrid", inputVoltage: [24], outputVoltage: [230], kva: 1.8, efficiency: 87.0, country: "India"},
    {brand: "Luminous", model: "Solar Hybrid PCU 3.5kVA", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 3.5, efficiency: 93.0, country: "India"},
    
    // Inverex - Pakistan
    {brand: "Inverex", model: "Nitrox 1.2kW", type: "Off-grid", inputVoltage: [12], outputVoltage: [230], kva: 1.2, efficiency: 86.0, country: "Pakistan"},
    {brand: "Inverex", model: "Aerox 3.2kW", type: "Hybrid", inputVoltage: [24], outputVoltage: [230], kva: 3.2, efficiency: 92.0, country: "Pakistan"},
    {brand: "Inverex", model: "Infini 5.2kW", type: "Hybrid", inputVoltage: [48], outputVoltage: [220, 230], kva: 5.2, efficiency: 95.0, country: "Pakistan"},
    
    // Must Solar - China
    {brand: "Must Solar", model: "PV18-2024 VPK", type: "Hybrid", inputVoltage: [24], outputVoltage: [230], kva: 2, efficiency: 90.0, country: "China"},
    {brand: "Must Solar", model: "PV18-5048 VPK", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 93.0, country: "China"},
    
    // Felicity - China
    {brand: "Felicity", model: "ESS 3K", type: "Hybrid", inputVoltage: [24, 48], outputVoltage: [220, 230], kva: 3, efficiency: 92.0, country: "China"},
    {brand: "Felicity", model: "ESS 5K", type: "Hybrid", inputVoltage: [48], outputVoltage: [220, 230], kva: 5, efficiency: 94.0, country: "China"},
    
    // Megarevo - China
    {brand: "Megarevo", model: "MIX 3.68kW", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 3.68, efficiency: 96.5, country: "China"},
    {brand: "Megarevo", model: "MIX 5kW", type: "Hybrid", inputVoltage: [48], outputVoltage: [230], kva: 5, efficiency: 97.0, country: "China"},
    
    // Sol-Ark - USA
    {brand: "Sol-Ark", model: "8K", type: "Hybrid", inputVoltage: [48], outputVoltage: [120, 240], kva: 8, efficiency: 97.5, country: "USA"},
    {brand: "Sol-Ark", model: "12K", type: "Hybrid", inputVoltage: [48], outputVoltage: [120, 240], kva: 12, efficiency: 97.8, country: "USA"},
    
    // OutBack Power - USA
    {brand: "OutBack", model: "Radian GS4048A", type: "Off-grid", inputVoltage: [48], outputVoltage: [120, 240], kva: 4, efficiency: 94.0, country: "USA"},
    {brand: "OutBack", model: "Radian GS8048A", type: "Off-grid", inputVoltage: [48], outputVoltage: [120, 240], kva: 8, efficiency: 95.0, country: "USA"}
];

// Make the database available globally - Multiple methods for compatibility
if (typeof window !== 'undefined') {
    window.inverterDatabase = inverterDatabase;
}

// Also make it available as a global variable
if (typeof global !== 'undefined') {
    global.inverterDatabase = inverterDatabase;
}

// CommonJS export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = inverterDatabase;
}

// Log confirmation
console.log('%c✓ Inverter Database Loaded Successfully', 'color: #10b981; font-weight: bold; font-size: 14px;');
console.log(`📊 Total Inverters: ${inverterDatabase.length} models`);
console.log(`🌍 Brands: Huawei, Sungrow, SMA, SolarEdge, Growatt, GoodWe, Victron, Fronius, Deye, SRNE, Delta, Schneider, Sineng, Luminous, Inverex, Must Solar, Felicity, Megarevo, Sol-Ark, OutBack`);
