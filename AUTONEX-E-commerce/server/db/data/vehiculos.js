// Vehículos de REFERENCIA del demo (versión 1). En la v2 ya no se cargan como vehículos: los reales vienen del
// registro DNRPA. Esta tabla describe la familia de motor y la plataforma de cada versión, y el seed la usa para
// asignar las compatibilidades de los repuestos de demostración a las versiones reales equivalentes
// (misma marca, modelo, años, cilindrada y combustible). Esas compatibilidades quedan como NEEDS_REVIEW.
//
// Datos internos de cada versión:
//   familia     -> familia de motor: los repuestos de motor se comparten entre versiones con la misma familia
//   plataforma  -> plataforma/chasis: frenos y suspensión se comparten dentro de la misma plataforma
//   faro        -> tipo de lámpara de luz baja (H4 / H7)
//   bateria     -> tamaño de batería original (12x65, 12x75, 12x90, 12x110)
//
// Formato de cada versión:
//   [version, motor, familia, combustible, desde, hasta, plataforma, faro, bateria]

export const MARCAS = [
  {
    nombre: 'Volkswagen',
    slug: 'volkswagen',
    modelos: [
      { nombre: 'Gol Trend', tipo: 'auto', versiones: [
        ['1.6 Trendline / Comfortline / Highline', '1.6 8v 101 CV (EA111)', 'VW_EA111', 'nafta', 2008, 2016, 'VW_PQ24', 'H4', '12x65'],
        ['1.6 MSI Trendline / Comfortline / Highline', '1.6 16v MSI 110 CV (EA211)', 'VW_EA211', 'nafta', 2017, 2023, 'VW_PQ24', 'H4', '12x65'],
      ] },
      { nombre: 'Suran', tipo: 'auto', versiones: [
        ['1.6 Comfortline / Highline', '1.6 8v 101 CV (EA111)', 'VW_EA111', 'nafta', 2006, 2015, 'VW_PQ24', 'H4', '12x65'],
        ['1.6 MSI Track / Highline', '1.6 16v MSI 110 CV (EA211)', 'VW_EA211', 'nafta', 2016, 2019, 'VW_PQ24', 'H4', '12x65'],
      ] },
      { nombre: 'Fox', tipo: 'auto', versiones: [
        ['1.6 Trendline / Highline', '1.6 8v 101 CV (EA111)', 'VW_EA111', 'nafta', 2004, 2014, 'VW_PQ24', 'H4', '12x65'],
        ['1.6 MSI Comfortline / Connect', '1.6 16v MSI 110 CV (EA211)', 'VW_EA211', 'nafta', 2015, 2021, 'VW_PQ24', 'H4', '12x65'],
      ] },
      { nombre: 'Polo', tipo: 'auto', versiones: [
        ['1.6 MSI Trendline / Comfortline', '1.6 16v MSI 110 CV (EA211)', 'VW_EA211', 'nafta', 2018, 2024, 'VW_MQB_A0', 'H7', '12x65'],
        ['1.0 TSI Highline', '1.0 TSI 116 CV turbo (EA211)', 'VW_TSI10', 'nafta', 2018, 2024, 'VW_MQB_A0', 'H7', '12x65'],
      ] },
      { nombre: 'Virtus', tipo: 'auto', versiones: [
        ['1.6 MSI Trendline / Comfortline', '1.6 16v MSI 110 CV (EA211)', 'VW_EA211', 'nafta', 2018, 2024, 'VW_MQB_A0', 'H7', '12x65'],
        ['1.0 TSI Highline', '1.0 TSI 116 CV turbo (EA211)', 'VW_TSI10', 'nafta', 2020, 2025, 'VW_MQB_A0', 'H7', '12x65'],
      ] },
      { nombre: 'Amarok', tipo: 'camioneta', versiones: [
        ['2.0 TDI 140 CV Startline / Trendline', '2.0 TDI 140 CV (EA189)', 'VW_TDI20', 'diesel', 2010, 2022, 'VW_AMAROK', 'H7', '12x110'],
        ['2.0 BiTDI 180 CV Highline', '2.0 BiTDI 180 CV (EA189)', 'VW_TDI20', 'diesel', 2010, 2022, 'VW_AMAROK', 'H7', '12x110'],
        ['3.0 V6 TDI Highline / Extreme', '3.0 V6 TDI 224/258 CV', 'VW_V6TDI', 'diesel', 2017, 2024, 'VW_AMAROK', 'H7', '12x110'],
      ] },
    ],
  },
  {
    nombre: 'Chevrolet',
    slug: 'chevrolet',
    modelos: [
      { nombre: 'Corsa', tipo: 'auto', versiones: [
        ['1.6 MPFI GL / GLS', '1.6 8v MPFI 92 CV (Família I)', 'GM_FAM1_16', 'nafta', 1996, 2002, 'GM_4200', 'H4', '12x65'],
        ['Corsa II 1.8 GL / GLS', '1.8 8v 105 CV (Família I)', 'GM_FAM1_18', 'nafta', 2002, 2010, 'GM_4200', 'H4', '12x65'],
      ] },
      { nombre: 'Classic', tipo: 'auto', versiones: [
        ['1.6 Base / Super', '1.6 8v 92 CV (Família I)', 'GM_FAM1_16', 'nafta', 2003, 2010, 'GM_4200', 'H4', '12x65'],
        ['1.4 LS / LT', '1.4 8v 97 CV (Família I SPE/4)', 'GM_FAM1_14', 'nafta', 2010, 2016, 'GM_4200', 'H4', '12x65'],
      ] },
      { nombre: 'Onix', tipo: 'auto', versiones: [
        ['1.4 LS / LT / LTZ', '1.4 8v 98 CV (Família I SPE/4)', 'GM_FAM1_14', 'nafta', 2012, 2019, 'GM_GSV', 'H4', '12x65'],
        ['1.2 LS / LT', '1.2 12v 90 CV 3 cil. (CSS Prime)', 'GM_CSS12', 'nafta', 2020, 2025, 'GM_GEM', 'H4', '12x65'],
        ['1.0 Turbo LT / Premier / RS', '1.0 12v Turbo 116 CV 3 cil. (CSS Prime)', 'GM_CSS10T', 'nafta', 2020, 2025, 'GM_GEM', 'H4', '12x65'],
      ] },
      { nombre: 'Prisma', tipo: 'auto', versiones: [
        ['1.4 LT / LTZ', '1.4 8v 98 CV (Família I SPE/4)', 'GM_FAM1_14', 'nafta', 2013, 2019, 'GM_GSV', 'H4', '12x65'],
      ] },
      { nombre: 'Cruze', tipo: 'auto', versiones: [
        ['1.8 LT / LTZ', '1.8 16v 141 CV (Ecotec F18D4)', 'GM_F18D4', 'nafta', 2010, 2015, 'GM_DELTA', 'H7', '12x75'],
        ['1.4 Turbo LT / LTZ / Premier', '1.4 16v Turbo 153 CV (Ecotec)', 'GM_14T', 'nafta', 2016, 2023, 'GM_D2XX', 'H7', '12x75'],
      ] },
      { nombre: 'S10', tipo: 'camioneta', versiones: [
        ['2.8 CTDI LS / LT / High Country', '2.8 TD 200 CV (Duramax)', 'GM_DURAMAX28', 'diesel', 2012, 2024, 'GM_S10', 'H7', '12x110'],
      ] },
    ],
  },
  {
    nombre: 'Fiat',
    slug: 'fiat',
    modelos: [
      { nombre: 'Palio', tipo: 'auto', versiones: [
        ['1.4 Fire ELX / Attractive', '1.4 8v Fire 85 CV', 'FIAT_FIRE14', 'nafta', 2007, 2017, 'FIAT_178', 'H4', '12x65'],
        ['1.6 16v Essence / Sporting', '1.6 16v E.torQ 115 CV', 'FIAT_ETORQ16', 'nafta', 2012, 2017, 'FIAT_178', 'H4', '12x65'],
      ] },
      { nombre: 'Siena', tipo: 'auto', versiones: [
        ['1.4 Fire EL / Attractive', '1.4 8v Fire 85 CV', 'FIAT_FIRE14', 'nafta', 2007, 2017, 'FIAT_178', 'H4', '12x65'],
        ['Grand Siena 1.6 16v Essence', '1.6 16v E.torQ 115 CV', 'FIAT_ETORQ16', 'nafta', 2012, 2018, 'FIAT_178', 'H4', '12x65'],
      ] },
      { nombre: 'Uno', tipo: 'auto', versiones: [
        ['Novo Uno 1.4 Fire Evo Attractive / Way', '1.4 8v Fire Evo 88 CV', 'FIAT_FIRE14', 'nafta', 2011, 2021, 'FIAT_178', 'H4', '12x65'],
      ] },
      { nombre: 'Cronos', tipo: 'auto', versiones: [
        ['1.3 Firefly Drive / Like', '1.3 8v Firefly 99 CV', 'FIAT_FIREFLY13', 'nafta', 2018, 2025, 'FIAT_MP1', 'H4', '12x65'],
        ['1.8 E.torQ Precision', '1.8 16v E.torQ 130 CV', 'FIAT_ETORQ18', 'nafta', 2018, 2022, 'FIAT_MP1', 'H4', '12x65'],
      ] },
      { nombre: 'Argo', tipo: 'auto', versiones: [
        ['1.3 Firefly Drive', '1.3 8v Firefly 99 CV', 'FIAT_FIREFLY13', 'nafta', 2017, 2024, 'FIAT_MP1', 'H4', '12x65'],
        ['1.8 E.torQ Precision / HGT', '1.8 16v E.torQ 130 CV', 'FIAT_ETORQ18', 'nafta', 2017, 2021, 'FIAT_MP1', 'H4', '12x65'],
      ] },
      { nombre: 'Toro', tipo: 'camioneta', versiones: [
        ['1.8 E.torQ Freedom', '1.8 16v E.torQ 130 CV', 'FIAT_ETORQ18', 'nafta', 2016, 2021, 'FIAT_TORO', 'H7', '12x75'],
        ['2.0 Multijet Freedom / Volcano / Ranch', '2.0 16v Multijet TD 170 CV', 'FIAT_MJ20', 'diesel', 2016, 2025, 'FIAT_TORO', 'H7', '12x90'],
      ] },
    ],
  },
  {
    nombre: 'Ford',
    slug: 'ford',
    modelos: [
      { nombre: 'Ka', tipo: 'auto', versiones: [
        ['1.0 / 1.6 Fly Viral / Pulse', '1.0 y 1.6 8v Zetec Rocam', 'FORD_ROCAM', 'nafta', 2008, 2014, 'FORD_B', 'H4', '12x65'],
        ['1.5 Dragon S / SE / SEL', '1.5 12v Dragon 105 CV 3 cil.', 'FORD_DRAGON15', 'nafta', 2016, 2021, 'FORD_B2', 'H4', '12x65'],
      ] },
      { nombre: 'Fiesta', tipo: 'auto', versiones: [
        ['Fiesta Max 1.6 Edge / Ambiente', '1.6 8v Zetec Rocam 98 CV', 'FORD_ROCAM', 'nafta', 2007, 2014, 'FORD_B', 'H4', '12x65'],
        ['Kinetic 1.6 S / SE / Titanium', '1.6 16v Sigma 120 CV', 'FORD_SIGMA16', 'nafta', 2011, 2019, 'FORD_B2', 'H4', '12x65'],
      ] },
      { nombre: 'EcoSport', tipo: 'auto', versiones: [
        ['1.6 XLS / XLT', '1.6 8v Zetec Rocam 98 CV', 'FORD_ROCAM', 'nafta', 2004, 2012, 'FORD_B', 'H4', '12x65'],
        ['1.6 S / SE / Freestyle', '1.6 16v Sigma 110 CV', 'FORD_SIGMA16', 'nafta', 2013, 2017, 'FORD_B2', 'H4', '12x65'],
        ['1.5 Dragon S / SE / Freestyle', '1.5 12v Dragon 123 CV 3 cil.', 'FORD_DRAGON15', 'nafta', 2018, 2022, 'FORD_B2', 'H4', '12x65'],
        ['2.0 Titanium 4WD', '2.0 16v Duratec 143 CV', 'FORD_DURATEC20', 'nafta', 2013, 2022, 'FORD_B2', 'H4', '12x75'],
      ] },
      { nombre: 'Focus', tipo: 'auto', versiones: [
        ['Focus II 2.0 Trend / Ghia', '2.0 16v Duratec 143 CV', 'FORD_DURATEC20', 'nafta', 2008, 2013, 'FORD_C1', 'H7', '12x75'],
        ['Focus III 1.6 S / SE', '1.6 16v Sigma 125 CV', 'FORD_SIGMA16', 'nafta', 2013, 2019, 'FORD_C1', 'H7', '12x65'],
        ['Focus III 2.0 SE Plus / Titanium', '2.0 16v Duratec GDI 170 CV', 'FORD_DURATEC20', 'nafta', 2013, 2019, 'FORD_C1', 'H7', '12x75'],
      ] },
      { nombre: 'Ranger', tipo: 'camioneta', versiones: [
        ['2.2 TDCi XL / XLS', '2.2 TDCi 150/160 CV (Duratorq)', 'FORD_PUMA', 'diesel', 2012, 2023, 'FORD_RANGER', 'H7', '12x110'],
        ['3.2 TDCi XLT / Limited', '3.2 TDCi 200 CV 5 cil. (Duratorq)', 'FORD_PUMA', 'diesel', 2012, 2023, 'FORD_RANGER', 'H7', '12x110'],
      ] },
    ],
  },
  {
    nombre: 'Peugeot',
    slug: 'peugeot',
    modelos: [
      { nombre: '207', tipo: 'auto', versiones: [
        ['207 Compact 1.4 XR / XS', '1.4 8v 75 CV (TU3)', 'PSA_TU3', 'nafta', 2008, 2016, 'PSA_PF1', 'H4', '12x65'],
        ['207 Compact 1.6 16v XS / XT', '1.6 16v 110 CV (TU5)', 'PSA_TU5', 'nafta', 2008, 2016, 'PSA_PF1', 'H4', '12x65'],
      ] },
      { nombre: '208', tipo: 'auto', versiones: [
        ['1.5 Active / Allure', '1.5 8v 90 CV (TU)', 'PSA_TU15', 'nafta', 2013, 2016, 'PSA_PF1', 'H7', '12x65'],
        ['1.6 16v Allure / Feline / GT', '1.6 16v 115 CV (TU5/EC5)', 'PSA_TU5', 'nafta', 2013, 2025, 'PSA_PF1', 'H7', '12x65'],
      ] },
      { nombre: '2008', tipo: 'auto', versiones: [
        ['1.6 16v Active / Allure', '1.6 16v 115 CV (EC5)', 'PSA_TU5', 'nafta', 2016, 2025, 'PSA_PF1', 'H7', '12x65'],
        ['1.6 THP Sport / Feline', '1.6 THP 165 CV turbo', 'PSA_THP16', 'nafta', 2016, 2020, 'PSA_PF1', 'H7', '12x75'],
      ] },
      { nombre: 'Partner', tipo: 'utilitario', versiones: [
        ['1.4 Confort', '1.4 8v 75 CV (TU3)', 'PSA_TU3', 'nafta', 2008, 2018, 'PSA_UTIL', 'H4', '12x65'],
        ['1.6 HDi Confort / Patagónica', '1.6 HDi 92 CV', 'PSA_HDI16', 'diesel', 2010, 2021, 'PSA_UTIL', 'H4', '12x75'],
      ] },
    ],
  },
  {
    nombre: 'Renault',
    slug: 'renault',
    modelos: [
      { nombre: 'Clio', tipo: 'auto', versiones: [
        ['Clio / Clio Mío 1.2 16v Confort / Dynamique', '1.2 16v 75 CV (D4F)', 'REN_D4F', 'nafta', 2004, 2016, 'REN_CLIO', 'H4', '12x65'],
      ] },
      { nombre: 'Sandero', tipo: 'auto', versiones: [
        ['1.6 8v Pack / Confort', '1.6 8v 90 CV (K7M)', 'REN_K7M', 'nafta', 2008, 2016, 'REN_B0', 'H4', '12x65'],
        ['1.6 16v Privilege / Stepway', '1.6 16v 105 CV (K4M)', 'REN_K4M', 'nafta', 2008, 2016, 'REN_B0', 'H4', '12x65'],
        ['1.6 16v SCe Life / Zen / Intens', '1.6 16v SCe 115 CV (H4M)', 'REN_H4M', 'nafta', 2017, 2025, 'REN_B0', 'H4', '12x65'],
      ] },
      { nombre: 'Logan', tipo: 'auto', versiones: [
        ['1.6 8v Pack / Expression', '1.6 8v 90 CV (K7M)', 'REN_K7M', 'nafta', 2008, 2016, 'REN_B0', 'H4', '12x65'],
        ['1.6 16v SCe Life / Zen', '1.6 16v SCe 115 CV (H4M)', 'REN_H4M', 'nafta', 2017, 2025, 'REN_B0', 'H4', '12x65'],
      ] },
      { nombre: 'Kangoo', tipo: 'utilitario', versiones: [
        ['1.6 8v Express / Confort', '1.6 8v 90 CV (K7M)', 'REN_K7M', 'nafta', 2008, 2018, 'REN_KANGOO', 'H4', '12x65'],
        ['1.5 dCi Express', '1.5 dCi 85 CV (K9K)', 'REN_K9K', 'diesel', 2008, 2018, 'REN_KANGOO', 'H4', '12x75'],
        ['Kangoo II 1.6 16v SCe Zen / Stepway', '1.6 16v SCe 115 CV (H4M)', 'REN_H4M', 'nafta', 2018, 2025, 'REN_KANGOO2', 'H4', '12x65'],
      ] },
      { nombre: 'Duster', tipo: 'auto', versiones: [
        ['1.6 16v Expression / Dynamique', '1.6 16v 110 CV (K4M)', 'REN_K4M', 'nafta', 2011, 2020, 'REN_DUSTER', 'H4', '12x65'],
        ['2.0 16v Privilege 4x4', '2.0 16v 143 CV (F4R)', 'REN_F4R', 'nafta', 2011, 2020, 'REN_DUSTER', 'H4', '12x75'],
      ] },
    ],
  },
  {
    nombre: 'Toyota',
    slug: 'toyota',
    modelos: [
      { nombre: 'Etios', tipo: 'auto', versiones: [
        ['1.5 X / XS / XLS', '1.5 16v 107 CV (2NR-FE)', 'TOY_2NR', 'nafta', 2013, 2022, 'TOY_ETIOS', 'H4', '12x65'],
      ] },
      { nombre: 'Corolla', tipo: 'auto', versiones: [
        ['1.8 XLi / XEi / SEG', '1.8 16v Dual VVT-i 140 CV (2ZR-FE)', 'TOY_2ZR', 'nafta', 2009, 2019, 'TOY_COROLLA', 'H7', '12x65'],
        ['2.0 XEi / SEG / GR-Sport', '2.0 16v Dynamic Force 170 CV (M20A)', 'TOY_M20A', 'nafta', 2020, 2025, 'TOY_TNGA', 'H7', '12x65'],
      ] },
      { nombre: 'Hilux', tipo: 'camioneta', versiones: [
        ['3.0 D-4D SR / SRV', '3.0 D-4D 171 CV (1KD-FTV)', 'TOY_1KD', 'diesel', 2005, 2015, 'TOY_HILUX7', 'H4', '12x110'],
        ['2.4 TDI DX / SR', '2.4 TDI 150 CV (2GD-FTV)', 'TOY_GD', 'diesel', 2016, 2025, 'TOY_HILUX8', 'H7', '12x110'],
        ['2.8 TDI SRV / SRX / GR-Sport', '2.8 TDI 177/204 CV (1GD-FTV)', 'TOY_GD', 'diesel', 2016, 2025, 'TOY_HILUX8', 'H7', '12x110'],
      ] },
    ],
  },
  {
    nombre: 'Citroën',
    slug: 'citroen',
    modelos: [
      { nombre: 'C3', tipo: 'auto', versiones: [
        ['1.4 SX / Exclusive', '1.4 8v 75 CV (TU3)', 'PSA_TU3', 'nafta', 2003, 2012, 'PSA_PF1', 'H4', '12x65'],
        ['1.5 Origine / Tendance', '1.5 8v 90 CV (TU)', 'PSA_TU15', 'nafta', 2013, 2017, 'PSA_PF1', 'H4', '12x65'],
        ['1.6 VTi Feel / Shine', '1.6 16v VTi 115 CV (EC5)', 'PSA_TU5', 'nafta', 2013, 2025, 'PSA_PF1', 'H4', '12x65'],
      ] },
      { nombre: 'C4', tipo: 'auto', versiones: [
        ['C4 2.0 16v SX / Exclusive', '2.0 16v 143 CV (EW10)', 'PSA_EW10', 'nafta', 2007, 2013, 'PSA_PF2', 'H7', '12x75'],
        ['C4 Lounge 1.6 THP Tendance / Feel / Shine', '1.6 THP 165 CV turbo', 'PSA_THP16', 'nafta', 2013, 2022, 'PSA_PF2', 'H7', '12x75'],
      ] },
      { nombre: 'Berlingo', tipo: 'utilitario', versiones: [
        ['1.4 Business', '1.4 8v 75 CV (TU3)', 'PSA_TU3', 'nafta', 2008, 2018, 'PSA_UTIL', 'H4', '12x65'],
        ['1.6 HDi Business / Multispace', '1.6 HDi 92 CV', 'PSA_HDI16', 'diesel', 2010, 2021, 'PSA_UTIL', 'H4', '12x75'],
      ] },
    ],
  },
];
