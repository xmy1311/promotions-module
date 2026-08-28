-- Datos de demostración para que la aplicación sea usable al primer arranque.

IF NOT EXISTS (SELECT 1 FROM dbo.products)
BEGIN
    INSERT INTO dbo.products (sku, name, category) VALUES
        ('BEB-001', 'Gaseosa 1.5 L',            'Bebidas'),
        ('BEB-002', 'Agua con gas 600 ml',      'Bebidas'),
        ('BEB-003', 'Jugo de naranja 1 L',      'Bebidas'),
        ('SNK-001', 'Papas fritas 150 g',       'Snacks'),
        ('SNK-002', 'Maní salado 200 g',        'Snacks'),
        ('LAC-001', 'Leche entera 1 L',         'Lácteos'),
        ('LAC-002', 'Yogur de fresa 1 kg',      'Lácteos'),
        ('ASE-001', 'Detergente líquido 3 L',   'Aseo'),
        ('ASE-002', 'Jabón de manos 400 ml',    'Aseo'),
        ('PAN-001', 'Pan tajado integral',      'Panadería');
END
