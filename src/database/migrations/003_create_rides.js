exports.up = function(knex) {
  return knex.schema.createTable('rides', function(table) {
    table.uuid('id').primary();
    table.uuid('customer_id').notNullable();
    table.uuid('driver_id').nullable();
    table.uuid('vehicle_id').nullable();
    table.enum('status', ['pending', 'confirmed', 'assigned', 'picked_up', 'in_progress', 'completed', 'cancelled']).defaultTo('pending');
    table.json('pickup_location').notNullable();
    table.json('dropoff_location').notNullable();
    table.json('extra_stops').defaultTo('[]');
    table.timestamp('scheduled_at').nullable();
    table.decimal('estimated_distance', 8, 2).defaultTo(0);
    table.integer('estimated_duration').defaultTo(0);
    table.decimal('actual_distance', 8, 2).defaultTo(0);
    table.integer('actual_duration').defaultTo(0);
    table.decimal('base_fare', 8, 2).defaultTo(0);
    table.decimal('distance_fare', 8, 2).defaultTo(0);
    table.decimal('time_fare', 8, 2).defaultTo(0);
    table.json('extra_fees').defaultTo('{}');
    table.decimal('total_fare', 8, 2).defaultTo(0);
    table.enum('payment_status', ['pending', 'authorized', 'paid', 'failed', 'refunded']).defaultTo('pending');
    table.string('payment_method').nullable();
    table.integer('passengers').defaultTo(1);
    table.integer('luggage').defaultTo(0);
    table.text('special_requests').nullable();
    table.text('notes').nullable();
    table.integer('rating').nullable();
    table.text('feedback').nullable();
    table.timestamp('pickup_time').nullable();
    table.timestamp('start_time').nullable();
    table.timestamp('end_time').nullable();
    table.timestamp('cancelled_at').nullable();
    table.text('cancel_reason').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.foreign('customer_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('driver_id').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('vehicle_id').references('id').inTable('vehicles').onDelete('SET NULL');
    table.index(['customer_id']);
    table.index(['driver_id']);
    table.index(['status']);
    table.index(['scheduled_at']);
    table.index(['created_at']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('rides');
};