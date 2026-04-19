-- Migration: Import PKW (passenger car) EV models - April 2026
-- Run with:
--   $env:PGPASSWORD='fleetpass'
--   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U fleetuser -d fleetdb -f 'backend/src/database/seed_cars_2026.sql'

INSERT INTO ev_models (manufacturer, model, segment, battery_gross_kwh, battery_usable_kwh, nominal_consumption_kwh_100km, max_ac_kw, max_dc_kw, payload_kg, cargo_volume_m3, purchase_price, lease_monthly, notes, is_active) VALUES

-- ─── KLEINWAGEN / CITY CARS ──────────────────────────────────────────────────
('Renault', 'Twingo E-Tech', 'car', 28.0, 25.0, 13.5, 11.0, 50.0, 450, 0.219, 22900, 339, 'Kleinstes Renault-EV, ideal für Stadtflotten', TRUE),
('Citroën', 'ë-C3 Basic', 'car', 44.0, 40.0, 16.0, 7.4, 100.0, 480, 0.310, 18947, 279, 'Günstigstes europäisches EV, ideal für Einstiegsflotten', TRUE),
('Citroën', 'ë-C3 Plus', 'car', 54.0, 50.0, 16.5, 11.0, 100.0, 480, 0.310, 23500, 349, 'Größere Batterie, mehr Reichweite', TRUE),
('Peugeot', 'e-208 Standard', 'car', 50.0, 45.0, 14.8, 11.0, 100.0, 395, 0.311, 29000, 429, 'Populärer Kompakt-EV für Firmenflotten', TRUE),
('Peugeot', 'e-208 Long Range', 'car', 54.0, 50.0, 15.0, 11.0, 100.0, 395, 0.311, 32000, 479, 'Erweiterte Reichweite', TRUE),
('Opel', 'Corsa Electric', 'car', 50.0, 45.0, 14.8, 11.0, 100.0, 395, 0.310, 29500, 435, 'Baugleich mit e-208, Opel-Variante', TRUE),
('Fiat', '500e 42kWh', 'car', 42.0, 37.0, 14.5, 11.0, 85.0, 385, 0.185, 28000, 415, 'Ikonisches Design, ideal für Stadtflotten', TRUE),
('Fiat', '500e 87kWh', 'car', 87.0, 80.0, 15.5, 11.0, 85.0, 385, 0.185, 38000, 565, 'Große Batterie-Version 500e', TRUE),
('Volkswagen', 'e-up!', 'car', 36.8, 32.3, 14.5, 7.2, 40.0, 350, 0.250, 27990, 415, 'Kleinster VW-EV, urbane Kurzstrecken', TRUE),

-- ─── KOMPAKTKLASSE / MITTELKLASSE ────────────────────────────────────────────
('Renault', '5 E-Tech 40kWh', 'car', 40.0, 36.0, 14.9, 11.0, 80.0, 450, 0.326, 24990, 369, 'Kompakter Stadtflitzer, niedrige Leasingrate', TRUE),
('Renault', '5 E-Tech 52kWh', 'car', 52.0, 48.0, 14.9, 11.0, 100.0, 450, 0.326, 31490, 469, 'Mehr Reichweite, ideal für Pendlerflotten', TRUE),
('Renault', 'Megane E-Tech 40kWh', 'car', 40.0, 38.0, 15.8, 11.0, 85.0, 480, 0.389, 34500, 509, 'Kompakte Limousine, gute TCO', TRUE),
('Renault', 'Megane E-Tech 60kWh', 'car', 60.0, 55.0, 15.8, 22.0, 130.0, 480, 0.389, 39500, 585, 'Mehr Reichweite, schnelles AC-Laden', TRUE),
('Volkswagen', 'ID.3 Pro 58kWh', 'car', 58.0, 52.0, 15.4, 11.0, 120.0, 437, 0.385, 37990, 549, 'Meistverkaufter VW-EV, idealer Dienstwagen', TRUE),
('Volkswagen', 'ID.3 Pro S 79kWh', 'car', 79.0, 72.0, 15.7, 11.0, 135.0, 437, 0.385, 43990, 649, 'Große Batterie, 550+ km WLTP', TRUE),
('Volkswagen', 'ID.3 GTX 79kWh', 'car', 79.0, 72.0, 16.5, 11.0, 185.0, 437, 0.385, 48990, 725, 'Performance-Variante ID.3', TRUE),
('Škoda', 'Enyaq 60', 'car', 62.0, 58.0, 16.5, 11.0, 120.0, 585, 0.585, 39990, 589, 'Günstigster Enyaq, gut für Familienflotten', TRUE),
('Škoda', 'Enyaq 85', 'car', 82.0, 77.0, 17.0, 11.0, 135.0, 585, 0.585, 47990, 709, 'Beste Reichweite im Segment', TRUE),
('Škoda', 'Enyaq 85x AWD', 'car', 82.0, 77.0, 18.5, 11.0, 135.0, 585, 0.585, 52990, 785, 'Allradantrieb, Wintereinsatz', TRUE),
('SEAT', 'Born 58kWh', 'car', 58.0, 52.0, 15.4, 11.0, 120.0, 437, 0.385, 35990, 529, 'VW ID.3 Pendant aus der SEAT-Familie', TRUE),
('SEAT', 'Born 77kWh', 'car', 79.0, 72.0, 15.7, 11.0, 135.0, 437, 0.385, 41990, 619, 'Größere Batterie-Option', TRUE),
('Hyundai', 'IONIQ 6 53kWh RWD', 'car', 53.0, 50.0, 14.5, 11.0, 151.0, 480, 0.401, 42900, 635, 'Aerodynamische Limousine, schnelles Laden', TRUE),
('Hyundai', 'IONIQ 6 77kWh RWD', 'car', 77.4, 74.0, 15.8, 11.0, 240.0, 480, 0.401, 49900, 739, 'Beste Reichweite IONIQ 6, 614 km WLTP', TRUE),
('Hyundai', 'IONIQ 6 77kWh AWD', 'car', 77.4, 74.0, 17.0, 11.0, 240.0, 480, 0.401, 54900, 815, 'Allrad-Version IONIQ 6', TRUE),
('Hyundai', 'IONIQ 5 58kWh RWD', 'car', 58.0, 53.0, 16.8, 11.0, 180.0, 520, 0.527, 44900, 665, 'Kompaktes SUV, V2L-fähig', TRUE),
('Hyundai', 'IONIQ 5 84kWh RWD', 'car', 84.0, 80.0, 17.5, 11.0, 240.0, 520, 0.527, 52900, 785, 'Große Batterie, 507 km WLTP', TRUE),
('Kia', 'EV3 58kWh', 'car', 58.5, 54.0, 14.5, 11.0, 100.0, 460, 0.460, 35900, 529, 'Neues Modell 2025, günstig und reichweitenstark', TRUE),
('Kia', 'EV3 81kWh', 'car', 81.4, 78.0, 14.9, 11.0, 120.0, 460, 0.460, 40350, 599, '605 km WLTP, bestes Preis-Reichweite im Segment', TRUE),
('Kia', 'EV6 58kWh RWD', 'car', 58.0, 54.0, 16.5, 11.0, 210.0, 480, 0.490, 42500, 629, 'Sportliches SUV-Coupé', TRUE),
('Kia', 'EV6 77kWh RWD', 'car', 77.4, 74.0, 16.5, 11.0, 240.0, 480, 0.490, 48500, 719, '528 km WLTP, schnelles 800V-Laden', TRUE),
('Kia', 'EV6 77kWh AWD', 'car', 77.4, 74.0, 18.0, 11.0, 240.0, 480, 0.490, 54500, 809, 'Allrad-Version', TRUE),
('Kia', 'EV9 76kWh AWD', 'car', 76.1, 72.0, 20.0, 11.0, 240.0, 600, 2.831, 59900, 889, '7-Sitzer SUV, ideal für Shuttle-Flotten', TRUE),
('Kia', 'EV9 99kWh AWD', 'car', 99.8, 95.0, 20.5, 11.0, 240.0, 600, 2.831, 69900, 1039, 'Große Batterie EV9, 563 km WLTP', TRUE),

-- ─── MITTELKLASSE PREMIUM ─────────────────────────────────────────────────────
('Tesla', 'Model 3 RWD', 'car', 60.0, 57.5, 14.9, 11.0, 170.0, 440, 0.594, 42990, 635, 'Meistverkauftes EV weltweit, exzellente TCO', TRUE),
('Tesla', 'Model 3 Long Range RWD', 'car', 75.0, 72.0, 15.3, 11.0, 250.0, 440, 0.594, 49990, 739, '702 km WLTP, bestes Supercharger-Netz', TRUE),
('Tesla', 'Model 3 Long Range AWD', 'car', 75.0, 72.0, 16.0, 11.0, 250.0, 440, 0.594, 54990, 815, 'Allrad, schnellste Aufladung', TRUE),
('Tesla', 'Model Y RWD', 'car', 60.0, 57.5, 15.7, 11.0, 170.0, 507, 2.158, 44990, 665, 'Meistverkauftes Auto Europa 2023/24', TRUE),
('Tesla', 'Model Y Long Range AWD', 'car', 75.0, 72.0, 17.0, 11.0, 250.0, 507, 2.158, 54990, 815, '600 km WLTP, Allrad', TRUE),
('BMW', 'i4 eDrive35', 'car', 70.0, 65.9, 16.0, 11.0, 180.0, 470, 0.470, 52900, 785, 'Kompakte Sportlimousine', TRUE),
('BMW', 'i4 eDrive40', 'car', 83.9, 80.7, 17.0, 11.0, 205.0, 470, 0.470, 58900, 875, 'Gran Coupé, 590 km WLTP, idealer Dienstwagen', TRUE),
('BMW', 'i4 M50 xDrive', 'car', 83.9, 80.7, 20.0, 11.0, 205.0, 470, 0.470, 76900, 1139, 'Performance-Variante, 544 km WLTP', TRUE),
('BMW', 'iX1 eDrive20', 'car', 66.5, 64.7, 17.0, 11.0, 130.0, 500, 0.490, 48900, 725, 'Kompaktes E-SUV, 475 km WLTP', TRUE),
('BMW', 'iX1 xDrive30', 'car', 66.5, 64.7, 18.5, 11.0, 130.0, 500, 0.490, 54900, 815, 'Allrad-Version iX1', TRUE),
('BMW', 'iX3 eDrive20', 'car', 80.0, 74.0, 18.5, 11.0, 150.0, 510, 0.510, 64900, 965, 'Mittelklasse-SUV, 460 km WLTP', TRUE),
('BMW', 'i5 eDrive40', 'car', 84.3, 81.2, 17.0, 11.0, 205.0, 500, 0.570, 74900, 1109, 'Elektrische 5er-Serie, Topmanager-Dienstwagen', TRUE),
('BMW', 'i7 xDrive60', 'car', 101.7, 98.0, 19.5, 11.0, 195.0, 550, 0.570, 135000, 1999, 'Luxus-Langstrecken-Limousine', TRUE),
('Mercedes-Benz', 'EQA 250+', 'car', 70.5, 66.5, 16.3, 11.0, 100.0, 470, 0.340, 49900, 739, 'Kompaktes E-SUV, günstigster Mercedes EV', TRUE),
('Mercedes-Benz', 'EQA 300 4MATIC', 'car', 70.5, 66.5, 18.0, 11.0, 100.0, 470, 0.340, 56900, 845, 'Allrad-Version EQA', TRUE),
('Mercedes-Benz', 'EQB 250+', 'car', 70.5, 66.5, 16.5, 11.0, 100.0, 495, 0.495, 53900, 799, '7-Sitzer Option, ideal für Shuttle', TRUE),
('Mercedes-Benz', 'EQC 400 4MATIC', 'car', 80.0, 75.0, 20.8, 11.0, 110.0, 500, 0.500, 69900, 1039, 'Mittelklasse-SUV, bewährte Plattform', TRUE),
('Mercedes-Benz', 'EQE 300', 'car', 90.6, 86.0, 18.0, 11.0, 170.0, 430, 0.430, 69900, 1039, 'Elektrische E-Klasse, Langstrecke', TRUE),
('Mercedes-Benz', 'EQE 350 4MATIC', 'car', 90.6, 86.0, 19.5, 11.0, 170.0, 430, 0.430, 79900, 1185, 'Allrad-Version EQE', TRUE),
('Mercedes-Benz', 'EQS 450+', 'car', 107.8, 104.0, 18.0, 22.0, 200.0, 485, 0.610, 109900, 1629, 'Flaggschiff-Limousine, 782 km WLTP', TRUE),
('Audi', 'Q4 e-tron 40', 'car', 82.0, 76.6, 17.5, 11.0, 135.0, 520, 0.520, 51980, 769, 'Meistgekaufter Audi EV, idealer Firmenwagen', TRUE),
('Audi', 'Q4 e-tron 45 quattro', 'car', 82.0, 76.6, 19.0, 11.0, 135.0, 520, 0.520, 59980, 889, 'Allrad-Version Q4', TRUE),
('Audi', 'Q6 e-tron', 'car', 100.0, 94.9, 18.5, 22.0, 270.0, 545, 0.526, 74900, 1109, 'Neue PPE-Plattform, 756V-Laden', TRUE),
('Audi', 'Q6 e-tron quattro', 'car', 100.0, 94.9, 20.0, 22.0, 270.0, 545, 0.526, 81900, 1215, 'Allrad Q6, sehr schnelles Laden', TRUE),
('Audi', 'A6 e-tron', 'car', 100.0, 94.9, 17.5, 22.0, 270.0, 502, 0.502, 79900, 1185, 'Elektrische A6-Limousine, PPE-Plattform', TRUE),
('Porsche', 'Taycan RWD', 'car', 79.2, 75.0, 19.8, 11.0, 225.0, 446, 0.446, 93800, 1389, 'Einstiegs-Taycan, Performance-Firmenwagen', TRUE),
('Porsche', 'Taycan 4S', 'car', 93.4, 89.0, 20.4, 11.0, 270.0, 446, 0.446, 111600, 1655, 'Allrad, 504 km WLTP', TRUE),
('Porsche', 'Taycan Turbo', 'car', 93.4, 89.0, 22.0, 11.0, 320.0, 446, 0.446, 162900, 2415, 'Top-Performance-Variante', TRUE),

-- ─── SUV / CROSSOVER ─────────────────────────────────────────────────────────
('Volkswagen', 'ID.4 Pro 77kWh', 'car', 82.0, 77.0, 17.5, 11.0, 135.0, 543, 1.985, 45490, 675, 'Meistverkauftes E-SUV Europas', TRUE),
('Volkswagen', 'ID.4 GTX 77kWh AWD', 'car', 82.0, 77.0, 19.0, 11.0, 135.0, 543, 1.985, 53490, 795, 'Allrad-Variante ID.4', TRUE),
('Volkswagen', 'ID.5 Pro 77kWh', 'car', 82.0, 77.0, 17.8, 11.0, 135.0, 543, 1.602, 47990, 715, 'Coupé-SUV, sportlicheres Design', TRUE),
('Volkswagen', 'ID.7 Pro 77kWh', 'car', 82.0, 77.0, 16.5, 11.0, 200.0, 543, 0.530, 54990, 815, 'Elektrische Mittelklasse-Limousine', TRUE),
('Volkswagen', 'ID.7 Pro S 86kWh', 'car', 91.0, 86.0, 16.0, 11.0, 200.0, 543, 0.530, 61990, 919, '700 km WLTP, idealer Manager-Dienstwagen', TRUE),
('Hyundai', 'Kona Electric 48kWh', 'car', 48.4, 46.0, 14.7, 11.0, 80.0, 436, 0.374, 33900, 499, 'Günstiger Kompakt-SUV', TRUE),
('Hyundai', 'Kona Electric 65kWh', 'car', 65.4, 62.0, 14.7, 11.0, 100.0, 436, 0.374, 38900, 575, '484 km WLTP, bestes Angebot im Segment', TRUE),
('Volvo', 'XC40 Recharge Pure Electric', 'car', 82.0, 78.0, 19.0, 11.0, 150.0, 452, 0.460, 52990, 789, 'Premium-Kompakt-SUV', TRUE),
('Volvo', 'C40 Recharge Pure Electric', 'car', 82.0, 78.0, 19.0, 11.0, 150.0, 413, 0.413, 54990, 815, 'Coupé-SUV-Variante des XC40', TRUE),
('Volvo', 'EX40 RWD', 'car', 69.0, 64.0, 17.0, 11.0, 150.0, 452, 0.460, 46990, 695, 'Neues Modell 2025, günstigerer Einstieg', TRUE),
('Polestar', '2 Single Motor', 'car', 82.0, 78.0, 17.0, 11.0, 205.0, 405, 0.405, 49990, 739, 'Sportliche Limousine, Google-Integration', TRUE),
('Polestar', '2 Long Range Single Motor', 'car', 82.0, 78.0, 16.5, 11.0, 205.0, 405, 0.405, 55990, 829, '635 km WLTP', TRUE),
('Polestar', '3 Long Range Single Motor', 'car', 111.0, 107.0, 20.0, 11.0, 250.0, 484, 2.100, 79990, 1185, 'Großes E-SUV, Performance und Reichweite', TRUE),
('Tesla', 'Model X Long Range AWD', 'car', 100.0, 96.0, 20.5, 11.0, 250.0, 600, 2.577, 104990, 1555, '7-Sitzer, 576 km WLTP', TRUE),
('Rivian', 'R2 Standard', 'car', 75.0, 70.0, 19.0, 11.0, 150.0, 500, 0.600, 45000, 669, 'Neues Modell 2026, kompaktes Adventure-SUV', TRUE);

-- Count result
SELECT segment, COUNT(*) as total FROM ev_models WHERE is_active = TRUE GROUP BY segment ORDER BY segment;
