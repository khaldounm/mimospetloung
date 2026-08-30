-- CreateTable
CREATE TABLE "service_cost_components" (
    "component_id" SERIAL NOT NULL,
    "service_id" INTEGER NOT NULL,
    "item_id" INTEGER,
    "quantity" DECIMAL(10,3),
    "label" VARCHAR(200),
    "amount" DECIMAL(12,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_cost_components_pkey" PRIMARY KEY ("component_id")
);

-- CreateIndex
CREATE INDEX "idx_service_cost_components_service" ON "service_cost_components"("service_id");

-- CreateIndex
CREATE INDEX "idx_service_cost_components_item" ON "service_cost_components"("item_id");

-- AddForeignKey
ALTER TABLE "service_cost_components" ADD CONSTRAINT "service_cost_components_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("service_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_cost_components" ADD CONSTRAINT "service_cost_components_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one shape per row: an inventory line (item + quantity) or a flat line
-- (label + amount), never a mix and never an empty row that claims a cost and
-- names nothing. Not expressible in Prisma, so it lives here with the rest of
-- the integrity rules.
ALTER TABLE "service_cost_components"
  ADD CONSTRAINT "service_cost_components_one_shape" CHECK (
    (
      "item_id" IS NOT NULL
      AND "quantity" IS NOT NULL
      AND "quantity" > 0
      AND "label" IS NULL
      AND "amount" IS NULL
    )
    OR (
      "item_id" IS NULL
      AND "quantity" IS NULL
      AND "label" IS NOT NULL
      AND "amount" IS NOT NULL
      AND "amount" >= 0
    )
  );
