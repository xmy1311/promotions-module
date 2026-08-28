--Esquema de base de datos para el módulo de promociones.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'products')
BEGIN
    CREATE TABLE dbo.products (
        id         INT IDENTITY(1,1) CONSTRAINT PK_products PRIMARY KEY,
        sku        NVARCHAR(40)  NOT NULL CONSTRAINT UQ_products_sku UNIQUE,
        name       NVARCHAR(120) NOT NULL,
        category   NVARCHAR(80)  NOT NULL,
        is_active  BIT           NOT NULL CONSTRAINT DF_products_is_active DEFAULT (1),
        created_at DATETIME2(3)  NOT NULL CONSTRAINT DF_products_created_at DEFAULT (SYSUTCDATETIME())
    );

    CREATE INDEX IX_products_category ON dbo.products (category);
END

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'promotions')
BEGIN
    CREATE TABLE dbo.promotions (
        id             INT IDENTITY(1,1) CONSTRAINT PK_promotions PRIMARY KEY,
        name           NVARCHAR(120) NOT NULL,
        target_type    VARCHAR(10)   NOT NULL,
        product_id     INT           NULL,
        category       NVARCHAR(80)  NULL,
        discount_type  VARCHAR(12)   NOT NULL,
        discount_value DECIMAL(12,2) NOT NULL,
        start_date     DATE          NOT NULL,
        end_date       DATE          NOT NULL,
        status         VARCHAR(12)   NOT NULL CONSTRAINT DF_promotions_status DEFAULT ('SCHEDULED'),
        created_at     DATETIME2(3)  NOT NULL CONSTRAINT DF_promotions_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at     DATETIME2(3)  NOT NULL CONSTRAINT DF_promotions_updated_at DEFAULT (SYSUTCDATETIME()),

        CONSTRAINT FK_promotions_product
            FOREIGN KEY (product_id) REFERENCES dbo.products (id),

        -- Producto o categoría, nunca ambos ni ninguno.
        CONSTRAINT CK_promotions_target CHECK (
            (target_type = 'PRODUCT'  AND product_id IS NOT NULL AND category   IS NULL) OR
            (target_type = 'CATEGORY' AND category   IS NOT NULL AND product_id IS NULL)
        ),
        CONSTRAINT CK_promotions_discount_type CHECK (discount_type IN ('PERCENTAGE', 'FIXED_AMOUNT')),
        CONSTRAINT CK_promotions_status        CHECK (status IN ('SCHEDULED', 'ACTIVE', 'FINISHED')),
        CONSTRAINT CK_promotions_dates         CHECK (end_date > start_date),
        CONSTRAINT CK_promotions_name          CHECK (LEN(LTRIM(RTRIM(name))) > 0),
        CONSTRAINT CK_promotions_value CHECK (
            discount_value > 0 AND
            (discount_type <> 'PERCENTAGE' OR discount_value <= 100)
        )
    );

    CREATE INDEX IX_promotions_status_dates ON dbo.promotions (status, start_date, end_date);
END
