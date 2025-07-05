exports.up = function(knex) {
  return knex.schema.createTable('no_shows', function(table) {
    table.uuid('id').primary();
    table.uuid('ride_id').notNullable();
    table.uuid('customer_id').notNullable();
    table.uuid('driver_id').nullable();
    table.enum('type', ['customer', 'driver']).notNullable();
    table.integer('wait_time').defaultTo(0);
    table.integer('max_wait_time').defaultTo(10);
    table.decimal('penalty', 8, 2).defaultTo(0);
    table.text('reason').nullable();
    table.json('evidence').defaultTo('[]');
    table.enum('status', ['pending', 'confirmed', 'disputed', 'resolved']).defaultTo('pending');
    table.timestamp('reported_at').defaultTo(knex.fn.now());
    table.timestamp('confirmed_at').nullable();
    table.timestamp('resolved_at').nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('ride_id').references('id').inTable('rides').onDelete('CASCADE');
    table.foreign('customer_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('driver_id').references('id').inTable('users').onDelete('SET NULL');
    table.index(['ride_id']);
    table.index(['customer_id']);
    table.index(['driver_id']);
    table.index(['type']);
    table.index(['status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('no_shows');
};