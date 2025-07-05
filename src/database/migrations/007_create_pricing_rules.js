exports.up = function(knex) {
  return knex.schema.createTable('pricing_rules', function(table) {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.enum('type', ['postcode', 'location', 'zone']).notNullable();
    table.json('from_location').notNullable();
    table.json('to_location').notNullable();
    table.decimal('fixed_price', 10, 2).notNullable();
    table.integer('priority').defaultTo(1);
    table.boolean('is_active').defaultTo(true);
    table.date('valid_from').nullable();
    table.date('valid_until').nullable();
    table.json('day_of_week').defaultTo('[]'); // [0,1,2,3,4,5,6]
    table.time('time_from').nullable();
    table.time('time_until').nullable();
    table.json('vehicle_types').defaultTo('[]');
    table.decimal('minimum_distance', 8, 2).defaultTo(0);
    table.decimal('maximum_distance', 8, 2).defaultTo(999);
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['type']);
    table.index(['is_active']);
    table.index(['priority']);
    table.index(['valid_from', 'valid_until']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('pricing_rules');
};