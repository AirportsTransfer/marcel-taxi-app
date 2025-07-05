exports.up = function(knex) {
  return knex.schema.createTable('payments', function(table) {
    table.uuid('id').primary();
    table.uuid('ride_id').notNullable();
    table.uuid('customer_id').notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.enum('method', ['cash', 'bank_transfer', 'card_in_taxi', 'online_card']).notNullable().defaultTo('cash');
    table.enum('status', ['pending', 'authorized', 'paid', 'failed', 'refunded']).notNullable().defaultTo('pending');
    table.string('authorization_id').nullable();
    table.string('transaction_id').nullable();
    table.json('bank_details').nullable();
    table.text('notes').nullable();
    table.timestamp('processed_at').nullable();
    table.timestamp('authorized_at').nullable();
    table.text('failure_reason').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('ride_id').references('id').inTable('rides').onDelete('CASCADE');
    table.foreign('customer_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['ride_id']);
    table.index(['customer_id']);
    table.index(['method']);
    table.index(['status']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('payments');
};