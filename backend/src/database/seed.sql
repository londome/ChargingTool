-- Seed data: Real EV models for fleet electrification platform
-- Last updated: April 2026
-- Sources: ev-database.org, electrifying.com, manufacturer specs

INSERT INTO ev_models (manufacturer, model, segment, battery_gross_kwh, battery_usable_kwh, nominal_consumption_kwh_100km, max_ac_kw, max_dc_kw, payload_kg, cargo_volume_m3, purchase_price, lease_monthly, notes, is_active) VALUES

-- ─── SMALL VANS (< 3.5t, Kompaktklasse) ─────────────────────────────────────

('Renault', 'Kangoo E-Tech L1', 'small_van', 45.0, 40.0, 22.0, 11.0, 80.0, 800, 3.9, 39900, 589, 'Kurze Version, ideal für Stadtlieferungen. DC-Laden optional.', TRUE),
('Renault', 'Kangoo E-Tech L2', 'small_van', 45.0, 40.0, 22.5, 11.0, 80.0, 764, 4.2, 41500, 615, 'Lange Version mit mehr Laderaum', TRUE),
('Nissan', 'Townstar EV L1', 'small_van', 45.0, 40.0, 22.0, 11.0, 80.0, 800, 3.3, 31700, 469, 'Auf Basis des Kangoo E-Tech, günstiger Einstiegspreis', TRUE),
('Nissan', 'Townstar EV L2', 'small_van', 45.0, 40.0, 22.5, 11.0, 80.0, 780, 4.9, 34200, 499, 'Lange Version mit erhöhtem Laderaumvolumen', TRUE),
('Citroën', 'ë-Berlingo Van L1', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 780, 3.9, 36390, 540, 'Kompakte Plattform PSA/Stellantis, auch als Furgon-Version', TRUE),
('Citroën', 'ë-Berlingo Van L2', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 780, 4.4, 38200, 565, 'Längere Version, höheres Ladevolumen', TRUE),
('Peugeot', 'e-Partner L1', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 780, 3.9, 36390, 540, 'Baugleich mit ë-Berlingo L1, Peugeot-Variante', TRUE),
('Peugeot', 'e-Partner L2', 'small_van', 50.0, 45.0, 23.5, 11.0, 100.0, 800, 4.4, 38500, 570, 'Längere Version, mehr Laderaum', TRUE),
('Opel', 'Combo-e Cargo L1', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 762, 3.8, 35900, 530, 'Opel-Version der PSA-Plattform', TRUE),
('Opel', 'Combo-e Cargo L2', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 762, 4.4, 37500, 555, 'Lange Version mit XL-Laderaum', TRUE),
('Fiat', 'E-Doblò L1', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 750, 3.9, 36000, 535, 'Fiat-Variante der Stellantis-Plattform', TRUE),
('Fiat', 'E-Doblò L2', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 750, 4.4, 38000, 560, 'Längere Version', TRUE),
('Toyota', 'Proace City Electric L1', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 800, 3.9, 38500, 570, 'Toyota-Version der PSA-Plattform', TRUE),
('Toyota', 'Proace City Electric L2', 'small_van', 50.0, 45.0, 23.5, 11.0, 100.0, 780, 4.4, 40000, 590, 'Längere Version', TRUE),
('Volkswagen', 'Caddy Cargo e', 'small_van', 45.0, 38.0, 22.0, 11.0, NULL, 710, 3.1, 38700, 575, 'Kompaktes Nutzfahrzeug für urbane Logistik', TRUE),
('Ford', 'E-Transit Courier', 'small_van', 38.0, 35.0, 21.0, 11.5, NULL, 650, 2.4, 31000, 460, 'Kleinstes E-Transit-Modell, sehr kompakt', TRUE),

-- ─── MEDIUM VANS (3.5t, Mittelklasse) ────────────────────────────────────────

('Ford', 'E-Transit Custom L1 340', 'medium_van', 64.0, 57.0, 24.0, 11.3, 125.0, 1136, 5.6, 48900, 720, 'Neue Plattform, sehr hohe Nutzlast, schnelles DC-Laden', TRUE),
('Ford', 'E-Transit Custom L2 340', 'medium_van', 64.0, 57.0, 24.5, 11.3, 125.0, 1088, 6.0, 51500, 755, 'Lange Version des E-Transit Custom', TRUE),
('Volkswagen', 'e-Transporter 6.1 L1', 'medium_van', 37.0, 35.8, 26.0, 7.2, NULL, 980, 5.8, 47900, 710, 'Kompakter Mittelklasse-Van, ältere Plattform', TRUE),
('Volkswagen', 'e-Transporter T7 L1', 'medium_van', 68.0, 63.8, 23.3, 11.0, 125.0, 1063, 5.8, 64867, 960, 'Neue Plattform MEB, deutlich mehr Reichweite', TRUE),
('Volkswagen', 'e-Transporter T7 L2', 'medium_van', 68.0, 63.8, 24.0, 11.0, 125.0, 1020, 6.4, 67500, 995, 'Lange Version, ideal für Handwerksbetriebe', TRUE),
('Volkswagen', 'ID. Buzz Cargo', 'medium_van', 82.0, 77.0, 21.0, 11.0, 170.0, 607, 3.9, 54900, 815, 'Ikonisches Design, zwei Euro-Paletten, lange Reichweite', TRUE),
('Mercedes-Benz', 'eVito Kastenwagen L2', 'medium_van', 66.0, 60.0, 26.0, 11.0, 80.0, 807, 6.0, 52000, 780, 'Bewährte Plattform, solide Reichweite', TRUE),
('Mercedes-Benz', 'eVito Kastenwagen L3', 'medium_van', 90.0, 83.0, 26.0, 11.0, 80.0, 850, 6.6, 62000, 930, 'Extra-Long Version mit 90 kWh Batterie', TRUE),
('Renault', 'Trafic E-Tech L1', 'medium_van', 52.0, 47.0, 25.0, 7.4, 50.0, 1100, 5.2, 44900, 665, 'Kompakter Trafic, gutes Nutzlast/Volumen-Verhältnis', TRUE),
('Renault', 'Trafic E-Tech L2', 'medium_van', 52.0, 47.0, 25.5, 7.4, 50.0, 1050, 5.8, 46900, 695, 'Längere Version des Trafic', TRUE),
('Opel', 'Vivaro-e L1', 'medium_van', 75.0, 70.0, 25.0, 11.0, 100.0, 1073, 5.3, 40464, 600, 'Starkes Preis-Leistungs-Verhältnis im Segment', TRUE),
('Opel', 'Vivaro-e L2', 'medium_van', 75.0, 70.0, 25.5, 11.0, 100.0, 1000, 6.6, 43500, 640, 'Lange Version mit mehr Laderaum', TRUE),
('Citroën', 'ë-Dispatch L1', 'medium_van', 75.0, 70.0, 25.0, 11.0, 100.0, 1073, 5.3, 40900, 605, 'Citroën-Variante der PSA-Mittelklasse-Plattform', TRUE),
('Citroën', 'ë-Dispatch L2', 'medium_van', 75.0, 70.0, 25.5, 11.0, 100.0, 1020, 6.6, 43900, 645, 'Längere Version', TRUE),
('Peugeot', 'e-Expert L1', 'medium_van', 75.0, 70.0, 25.0, 11.0, 100.0, 1073, 5.3, 41000, 608, 'Peugeot-Variante, identische Specs wie ë-Dispatch', TRUE),
('Peugeot', 'e-Expert L2', 'medium_van', 75.0, 70.0, 25.5, 11.0, 100.0, 1020, 6.6, 44000, 648, 'Längere Version', TRUE),
('Toyota', 'Proace Electric L1', 'medium_van', 75.0, 70.0, 25.0, 11.0, 100.0, 1073, 5.3, 42500, 625, 'Toyota-Version der PSA-Mittelklasse', TRUE),
('Toyota', 'Proace Electric L2', 'medium_van', 75.0, 70.0, 25.5, 11.0, 100.0, 1020, 6.6, 44900, 660, 'Längere Version', TRUE),
('Fiat', 'E-Scudo L1', 'medium_van', 75.0, 70.0, 25.0, 11.0, 100.0, 1073, 5.3, 40500, 600, 'Fiat-Variante der PSA-Mittelklasse', TRUE),
('Fiat', 'E-Scudo L2', 'medium_van', 75.0, 70.0, 25.5, 11.0, 100.0, 1020, 6.6, 43000, 635, 'Längere Version', TRUE),
('Maxus', 'eDeliver 5 L1', 'medium_van', 64.0, 60.0, 24.0, 11.0, NULL, 1200, 6.6, 36000, 530, 'Chinesischer Hersteller, sehr gutes Preis-Leistungs-Verhältnis', TRUE),
('Maxus', 'eDeliver 5 L2', 'medium_van', 64.0, 60.0, 24.5, 11.0, NULL, 1100, 7.6, 38000, 560, 'Lange Version', TRUE),

-- ─── LARGE VANS (3.5t, Großraumklasse) ───────────────────────────────────────

('Mercedes-Benz', 'eSprinter 312 L2H2 56kWh', 'large_van', 56.0, 50.0, 28.0, 9.6, 80.0, 1273, 9.0, 60000, 950, 'Einstiegsvariante eSprinter, kürzere Reichweite', TRUE),
('Mercedes-Benz', 'eSprinter 312 L2H2 113kWh', 'large_van', 113.0, 103.0, 27.0, 22.0, 115.0, 904, 10.5, 69900, 1100, 'Standard-Hochraumkasten, maximale Reichweite', TRUE),
('Mercedes-Benz', 'eSprinter 312 L3H2 113kWh', 'large_van', 113.0, 103.0, 28.0, 22.0, 115.0, 736, 11.5, 74500, 1180, 'Langversion, für größere Frachten', TRUE),
('Mercedes-Benz', 'eSprinter 314 L2H3 113kWh', 'large_van', 113.0, 103.0, 28.5, 22.0, 115.0, 650, 12.0, 76000, 1200, 'Hochraumversion L2H3', TRUE),
('Ford', 'E-Transit 350 L2H2', 'large_van', 68.0, 61.5, 27.0, 11.3, 115.0, 1758, 11.0, 58000, 890, 'Beste Nutzlast im Großvan-Segment', TRUE),
('Ford', 'E-Transit 350 L3H2', 'large_van', 68.0, 61.5, 27.5, 11.3, 115.0, 1616, 13.0, 62400, 960, 'Langversion mit sehr hohem Ladevolumen', TRUE),
('Ford', 'E-Transit 350 L3H3', 'large_van', 68.0, 61.5, 28.0, 11.3, 115.0, 1500, 15.1, 65000, 995, 'Maximal-Version, 15 m³', TRUE),
('Ford', 'E-Transit 390 L4H3', 'large_van', 68.0, 61.5, 29.0, 11.3, 115.0, 1400, 17.0, 69000, 1050, 'Größte E-Transit-Konfiguration', TRUE),
('Renault', 'Master E-Tech L2H2', 'large_van', 87.0, 82.0, 27.0, 22.0, 130.0, 1625, 11.0, 68000, 1090, 'Höchste Batteriekapazität im Segment, schnelles AC-Laden', TRUE),
('Renault', 'Master E-Tech L3H2', 'large_van', 87.0, 82.0, 27.5, 22.0, 130.0, 1400, 13.0, 71000, 1130, 'Langversion', TRUE),
('Renault', 'Master E-Tech L3H3', 'large_van', 87.0, 82.0, 28.0, 22.0, 130.0, 1200, 14.8, 74000, 1170, 'Maximal-Hochraumversion', TRUE),
('Citroën', 'ë-Jumper L2H2', 'large_van', 75.0, 70.0, 27.5, 22.0, 50.0, 1200, 10.8, 62000, 980, 'Neue Generation PSA-Großvan, verbesserte Reichweite', TRUE),
('Citroën', 'ë-Jumper L3H2', 'large_van', 75.0, 70.0, 28.0, 22.0, 50.0, 1100, 13.0, 65000, 1020, 'Langversion', TRUE),
('Peugeot', 'e-Boxer L2H2', 'large_van', 75.0, 70.0, 27.5, 22.0, 50.0, 1200, 10.8, 62500, 985, 'Peugeot-Variante des ë-Jumper', TRUE),
('Peugeot', 'e-Boxer L3H2', 'large_van', 75.0, 70.0, 28.0, 22.0, 50.0, 1080, 13.0, 65500, 1025, 'Langversion', TRUE),
('Fiat', 'E-Ducato L2H2', 'large_van', 79.0, 73.0, 27.5, 22.0, 50.0, 1245, 10.8, 63000, 990, 'Leicht größere Batterie als Citroën/Peugeot', TRUE),
('Fiat', 'E-Ducato L3H2', 'large_van', 79.0, 73.0, 28.0, 22.0, 50.0, 1045, 13.1, 66000, 1035, 'Langversion', TRUE),
('Opel', 'Movano-e L2H2', 'large_van', 70.0, 64.0, 27.5, 11.5, 50.0, 1263, 10.8, 61000, 960, 'Opel-Version des Großvan-Segments', TRUE),
('Opel', 'Movano-e L3H2', 'large_van', 70.0, 64.0, 28.0, 11.5, 50.0, 1080, 13.0, 64000, 1000, 'Langversion', TRUE),
('Vauxhall', 'Movano-e L3H2', 'large_van', 70.0, 64.0, 28.0, 11.5, 150.0, 635, 17.0, 63000, 990, 'UK-Variante, höhere DC-Ladeleistung', TRUE),
('Maxus', 'eDeliver 9 L2H2', 'large_van', 88.6, 83.0, 27.0, 11.0, 90.0, 1200, 9.7, 52000, 780, 'Chinesischer Hersteller, sehr gutes Preis-Leistungs-Verhältnis', TRUE),
('Maxus', 'eDeliver 9 L3H2', 'large_van', 88.6, 83.0, 27.5, 11.0, 90.0, 1040, 11.0, 55000, 820, 'Langversion eDeliver 9', TRUE),
('MAN', 'eTGE 3.5t L2H2', 'large_van', 35.8, 32.0, 26.0, 7.2, NULL, 993, 10.7, 66500, 1045, 'VW e-Crafter Pendant aus dem MAN-Konzern', TRUE),
('Volkswagen', 'e-Crafter 35 L3H3', 'large_van', 35.8, 32.0, 27.0, 7.2, NULL, 1000, 10.7, 67800, 1050, 'Ältere Plattform, begrenzte Reichweite', TRUE),
('Kia', 'PV5 Cargo 51kWh', 'large_van', 51.5, 47.0, 22.0, 11.0, 80.0, 790, 4.5, 33500, 495, 'Neues Modell 2025, International Van of the Year 2026', TRUE),
('Kia', 'PV5 Cargo 71kWh', 'large_van', 71.2, 65.0, 22.5, 11.0, 150.0, 790, 4.5, 38500, 570, 'Große Batterie-Option, lange Reichweite', TRUE),

-- ─── LIGHT TRUCKS (7.5t) ─────────────────────────────────────────────────────

('Mercedes-Benz', 'eAtego 7.5t', 'light_truck', 150.0, 141.0, 45.0, 22.0, 150.0, 3200, NULL, 130000, 2200, 'Elektrischer Verteiler-LKW 7.5t, ideal für städtische Logistik', TRUE),
('Volvo', 'FL Electric 7.5t', 'light_truck', 150.0, 138.0, 44.0, 22.0, 150.0, 3500, NULL, 140000, 2350, 'Bewährte Volvo-Plattform, modulares Batteriesystem', TRUE),
('MAN', 'eTGM 7.5t', 'light_truck', 185.0, 170.0, 46.0, 22.0, 150.0, 3800, NULL, 155000, 2600, 'MAN Elektro-LKW 7.5t, hohe Nutzlast', TRUE),
('DAF', 'LF Electric 7.5t', 'light_truck', 141.0, 130.0, 44.0, 22.0, 150.0, 3200, NULL, 128000, 2150, 'DAF-Einstieg ins E-LKW Segment', TRUE),
('Maxus', 'eT90 7.5t', 'light_truck', 88.5, 82.0, 42.0, 11.0, 90.0, 1000, NULL, 65000, 1100, 'Elektrischer Pickup/Leicht-LKW, sehr günstig', TRUE),

-- ─── MEDIUM TRUCKS (12–18t) ──────────────────────────────────────────────────

('Mercedes-Benz', 'eAtego 16t', 'medium_truck', 300.0, 280.0, 50.0, 22.0, 160.0, 7500, NULL, 180000, 3100, 'Standard-Verteiler-LKW 16t, Stadtlogistik', TRUE),
('Renault', 'D Z.E. 16t', 'medium_truck', 265.0, 245.0, 55.0, 43.0, NULL, 6500, NULL, 185000, 3200, 'Stadtlieferfahrzeug 16t zGG, ideal für KEP', TRUE),
('Volvo', 'FL Electric 16t', 'medium_truck', 265.0, 250.0, 52.0, 22.0, 150.0, 9200, NULL, 210000, 3600, 'Modulares Batteriesystem, hohe Nutzlast', TRUE),
('Volvo', 'FE Electric 18t', 'medium_truck', 300.0, 282.0, 54.0, 22.0, 150.0, 10500, NULL, 240000, 4100, 'Schwereres Modell bis 18t, für intensivere Einsätze', TRUE),
('MAN', 'eTGM 18t', 'medium_truck', 185.0, 168.0, 48.0, 22.0, 150.0, 9000, NULL, 220000, 3800, 'MAN Elektro-LKW 18t', TRUE),
('DAF', 'LF Electric 16t', 'medium_truck', 222.0, 207.0, 47.0, 22.0, 150.0, 8200, NULL, 195000, 3350, 'DAF Elektro-LKW 16t, lange Reichweite', TRUE),
('Iveco', 'E-Daily 35S 72kWh', 'medium_truck', 72.0, 67.0, 35.0, 22.0, 50.0, 1630, NULL, 75000, 1250, 'Elektrischer Daily, Übergang LCV/Truck', TRUE),
('Iveco', 'E-Daily 35S 111kWh', 'medium_truck', 111.0, 103.0, 35.0, 22.0, 50.0, 1390, NULL, 92000, 1550, 'Große Batterie-Option E-Daily', TRUE),

-- ─── HEAVY TRUCKS (> 18t / Fernverkehr) ─────────────────────────────────────

('Mercedes-Benz', 'eActros 300 4x2', 'heavy_truck', 336.0, 315.0, 110.0, 43.0, 160.0, 19000, NULL, 270000, 4600, 'Elektrischer Fernverkehrs-LKW, bis 300 km Reichweite', TRUE),
('Mercedes-Benz', 'eActros 400 4x2', 'heavy_truck', 448.0, 420.0, 115.0, 43.0, 160.0, 17000, NULL, 320000, 5400, 'Maximale Reichweite eActros-Familie', TRUE),
('Mercedes-Benz', 'eActros 600 4x2', 'heavy_truck', 621.0, 587.0, 115.0, 43.0, 1000.0, 22000, NULL, 380000, 6400, 'Langstrecken-Flaggschiff, MCS-Laden bis 1 MW', TRUE),
('Volvo', 'FH Electric 4x2', 'heavy_truck', 540.0, 510.0, 110.0, 43.0, 250.0, 21000, NULL, 350000, 5900, 'Marktführer E-Truck Europa, bis 300 km real', TRUE),
('Volvo', 'FH Aero Electric 4x2', 'heavy_truck', 540.0, 510.0, 105.0, 43.0, 250.0, 21000, NULL, 370000, 6200, 'Aerodynamisch optimierte Version, ca. 10% weniger Verbrauch', TRUE),
('Volvo', 'FM Electric 4x2', 'heavy_truck', 396.0, 374.0, 108.0, 43.0, 250.0, 18500, NULL, 300000, 5100, 'Schwerer Verteiler-LKW bis 26t', TRUE),
('DAF', 'XF Electric 4x2', 'heavy_truck', 450.0, 421.0, 112.0, 43.0, 350.0, 20000, NULL, 340000, 5700, 'DAF Fernverkehrs-LKW, schnelles CCS-Laden', TRUE),
('DAF', 'XD Electric 4x2', 'heavy_truck', 315.0, 295.0, 108.0, 43.0, 350.0, 18000, NULL, 270000, 4600, 'Regionaler Verteiler-LKW', TRUE),
('MAN', 'eTGX 4x2', 'heavy_truck', 480.0, 450.0, 112.0, 43.0, 200.0, 20000, NULL, 330000, 5600, 'MAN Fernverkehrs-LKW, MAN ChargingNet kompatibel', TRUE),
('Scania', 'BEV R 4x2', 'heavy_truck', 624.0, 588.0, 110.0, 43.0, 375.0, 21000, NULL, 390000, 6600, 'Größte Batteriekapazität im Segment, Megawatt-Laden', TRUE),
('Scania', 'BEV P 4x2', 'heavy_truck', 396.0, 373.0, 108.0, 43.0, 375.0, 18000, NULL, 300000, 5100, 'Regionaler Einsatz, kompaktere Bauform', TRUE),
('Iveco', 'S-WAY Electric 4x2', 'heavy_truck', 320.0, 300.0, 113.0, 43.0, 160.0, 17000, NULL, 280000, 4800, 'Iveco Fernverkehrs-LKW, begrenzte Reichweite', TRUE),
('Renault', 'T E-Tech 4x2', 'heavy_truck', 400.0, 375.0, 110.0, 43.0, 300.0, 20000, NULL, 320000, 5400, 'Renault Trucks Fernverkehr-BEV', TRUE),

-- ─── PICKUP TRUCKS ───────────────────────────────────────────────────────────

('Maxus', 'T90 EV', 'light_truck', 88.5, 82.0, 30.0, 11.0, 90.0, 1000, NULL, 42000, 620, 'Elektrischer Pickup, 88.5 kWh, 354 km Reichweite', TRUE),
('Ford', 'F-150 Lightning Pro', 'light_truck', 98.0, 92.0, 35.0, 19.2, 150.0, 907, NULL, 55000, 820, 'US-Markt, zunehmend in Europa verfügbar', TRUE);

-- Create a default demo user
INSERT INTO users (email, name) VALUES
  ('demo@flotte.de', 'Demo Benutzer')
ON CONFLICT (email) DO NOTHING;
