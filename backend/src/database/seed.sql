-- Seed data: Real EV models for fleet electrification platform

INSERT INTO ev_models (manufacturer, model, segment, battery_gross_kwh, battery_usable_kwh, nominal_consumption_kwh_100km, max_ac_kw, max_dc_kw, payload_kg, cargo_volume_m3, purchase_price, lease_monthly, notes, is_active) VALUES

-- Small Vans (< 3.5t)
('Renault', 'Kangoo E-Tech Electric', 'small_van', 45.0, 40.0, 22.0, 11.0, NULL, 800, 3.9, 39900, 589, 'Kurze Lieferkonfiguration, ideal für Stadtlieferungen', TRUE),
('Stellantis', 'Citroën ë-Berlingo L1', 'small_van', 50.0, 45.0, 23.0, 11.0, 100.0, 750, 3.9, 41500, 620, 'Kompakte Nutzfahrzeugversion, auch als Peugeot e-Partner verfügbar', TRUE),
('Stellantis', 'Peugeot e-Partner L2', 'small_van', 50.0, 45.0, 23.5, 11.0, 100.0, 800, 4.4, 43200, 640, 'Verlängte Version mit größerem Laderaum', TRUE),
('Volkswagen', 'Caddy Cargo e', 'small_van', 45.0, 38.0, 22.0, 11.0, NULL, 710, 3.1, 38700, 575, 'Kompaktes Nutzfahrzeug für urbane Logistik', TRUE),
('Ford', 'E-Transit Custom', 'small_van', 64.0, 57.0, 24.0, 11.4, 115.0, 1136, 5.6, 48900, 720, 'Neue Plattform, sehr hohe Nutzlast im Segment', TRUE),

-- Medium Vans (3.5t)
('Mercedes-Benz', 'eSprinter 312 L2H2', 'large_van', 113.0, 100.0, 27.0, 22.0, 80.0, 904, 10.5, 69900, 1100, 'Standard-Hochraumkasten, Standardversion', TRUE),
('Mercedes-Benz', 'eSprinter 312 L3H2', 'large_van', 113.0, 100.0, 28.0, 22.0, 80.0, 736, 11.5, 74500, 1180, 'Langversion, für größere Frachten', TRUE),
('Volkswagen', 'e-Crafter 35 L3H3', 'large_van', 35.8, 32.0, 27.0, 7.2, NULL, 1000, 10.7, 67800, 1050, 'Bewährter Elektrivan, ältere Generation', TRUE),
('Ford', 'E-Transit 350 L3H3', 'large_van', 68.0, 61.5, 28.0, 11.3, 115.0, 1616, 15.1, 62400, 960, 'Beste Nutzlast im Segment, schnelles DC-Laden', TRUE),
('Stellantis', 'Citroën ë-Jumper L3H2', 'large_van', 75.0, 70.0, 28.0, 22.0, 50.0, 1100, 13.0, 65000, 1020, 'Neue Generation mit verbesserter Reichweite', TRUE),
('Stellantis', 'Peugeot e-Boxer L3H2', 'large_van', 75.0, 70.0, 28.0, 22.0, 50.0, 1080, 13.0, 65500, 1025, 'Baugleich mit ë-Jumper, Peugeot-Variante', TRUE),
('Stellantis', 'Fiat E-Ducato L3H2', 'large_van', 79.0, 73.0, 28.0, 22.0, 50.0, 1045, 13.1, 66000, 1035, 'Leicht größere Batterie als Peugeot/Citroën', TRUE),
('Renault', 'Master E-Tech Electric', 'large_van', 87.0, 82.0, 27.0, 22.0, NULL, 1200, 13.0, 68000, 1090, 'Höchste Batteriekapazität im Segment', TRUE),

-- Medium Trucks
('Renault', 'D Z.E. 16t', 'medium_truck', 265.0, 245.0, 55.0, 43.0, NULL, 6500, NULL, 185000, 3200, 'Stadtlieferfahrzeug 16t zGG, ideal für KEP', TRUE),
('Volvo', 'FL Electric 16t', 'medium_truck', 265.0, 250.0, 52.0, 22.0, 150.0, 9200, NULL, 210000, 3600, 'Modulares Batteriesystem, hohe Nutzlast', TRUE),
('MAN', 'eTGE 3.5t', 'large_van', 35.8, 32.0, 26.0, 7.2, NULL, 993, 11.0, 66500, 1045, 'VW e-Crafter Pendant aus dem MAN-Konzern', TRUE),
('Stellantis', 'Opel Movano-e L3H2', 'large_van', 70.0, 64.0, 28.0, 11.5, 50.0, 1080, 13.0, 64000, 1000, 'Kompetitives Angebot, Vauxhall-Pendants verfügbar', TRUE);

-- Create a default demo user
INSERT INTO users (email, name) VALUES
  ('demo@flotte.de', 'Demo Benutzer')
ON CONFLICT (email) DO NOTHING;
