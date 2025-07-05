exports.up = function(knex) {
  return knex.schema.createTable('ride_shares', function(table) {
    table.uuid('id').primary();
    table.uuid('original_ride_id').notNullable();
    table.uuid('source_company_id').notNullable();
    table.uuid('target_company_id').notNullable();
    table.uuid('partnership_id').notNullable();
    table.enum('status', ['offered', 'accepted', 'rejected', 'completed', 'cancelled']).defaultTo('offered');
    table.decimal('offer_price', 10, 2).notNullable();
    table.decimal('commission_amount', 10, 2).defaultTo(0);
    table.decimal('accepted_price', 10, 2).nullable();
    table.uuid('assigned_driver_id').nullable();
    table.uuid('assigned_vehicle_id').nullable();
    table.json('ride_data').notNullable();
    table.integer('response_time').nullable(); // in minutes
    table.timestamp('accepted_at').nullable();
    table.timestamp('completed_at').nullable();
    table.text('rejection_reason').nullable();
    table.text('cancellation_reason').nullable();
    table.text('notes').nullable();
    table.timestamp('expires_at').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('original_ride_id').references('id').inTable('rides').onDelete('CASCADE');
    table.foreign('partnership_id').references('id').inTable('company_partnerships').onDelete('CASCADE');
    table.foreign('assigned_driver_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('assigned_vehicle_id').references('id').inTable('vehicles').onDelete('SET NULL');
    
    table.index(['original_ride_id']);
    table.index(['source_company_id']);
    table.index(['target_company_id']);
    table.index(['partnership_id']);
    table.index(['status']);
    table.index(['expires_at']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('ride_shares');
};