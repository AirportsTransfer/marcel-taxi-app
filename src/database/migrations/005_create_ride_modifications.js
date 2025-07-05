exports.up = function(knex) {
  return knex.schema.createTable('ride_modifications', function(table) {
    table.uuid('id').primary();
    table.uuid('ride_id').notNullable();
    table.uuid('customer_id').notNullable();
    table.string('token').notNullable().unique();
    table.timestamp('expires_at').notNullable();
    table.json('modifications').defaultTo('{}');
    table.json('original_data').defaultTo('{}');
    table.enum('status', ['pending', 'applied', 'expired', 'cancelled']).defaultTo('pending');
    table.text('reason').nullable();
    table.timestamp('applied_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('ride_id').references('id').inTable('rides').onDelete('CASCADE');
    table.foreign('customer_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['ride_id']);
    table.index(['customer_id']);
    table.index(['token']);
    table.index(['status']);
    table.index(['expires_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ride_modifications');
};