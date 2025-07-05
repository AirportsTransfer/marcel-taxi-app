exports.up = function(knex) {
  return knex.schema.createTable('vehicles', function(table) {
    table.uuid('id').primary();
    table.string('license_plate').notNullable().unique();
    table.string('brand').notNullable();
    table.string('model').notNullable();
    table.integer('year').notNullable();
    table.string('color').notNullable();
    table.integer('seats').notNullable().defaultTo(4);
    table.enum('vehicle_type', ['sedan', 'suv', 'van', 'luxury']).defaultTo('sedan');
    table.boolean('is_active').defaultTo(true);
    table.uuid('driver_id').nullable();
    table.json('features').defaultTo('[]');
    table.string('fuel_type').defaultTo('benzine');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('driver_id').references('id').inTable('users').onDelete('SET NULL');
    table.index(['license_plate']);
    table.index(['driver_id']);
    table.index(['is_active']);
    table.index(['vehicle_type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('vehicles');
};