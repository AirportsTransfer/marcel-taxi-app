exports.up = function(knex) {
  return knex.schema.createTable('driver_locations', function(table) {
    table.uuid('id').primary();
    table.uuid('driver_id').notNullable();
    table.uuid('vehicle_id').nullable();
    table.uuid('ride_id').nullable();
    table.decimal('latitude', 10, 8).notNullable();
    table.decimal('longitude', 11, 8).notNullable();
    table.decimal('accuracy', 8, 2).defaultTo(0);
    table.decimal('altitude', 8, 2).nullable();
    table.decimal('speed', 6, 2).defaultTo(0);
    table.decimal('heading', 5, 2).nullable();
    table.string('address').nullable();
    table.enum('status', ['available', 'busy', 'offline', 'break']).defaultTo('available');
    table.integer('battery_level').nullable();
    table.boolean('is_gps_enabled').defaultTo(true);
    table.timestamp('last_movement').defaultTo(knex.fn.now());
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('driver_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('vehicle_id').references('id').inTable('vehicles').onDelete('SET NULL');
    table.foreign('ride_id').references('id').inTable('rides').onDelete('SET NULL');
    
    // Ensure one location per driver (upsert pattern)
    table.unique(['driver_id']);
    table.index(['driver_id']);
    table.index(['status']);
    table.index(['ride_id']);
    table.index(['latitude', 'longitude']);
    table.index(['updated_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('driver_locations');
};