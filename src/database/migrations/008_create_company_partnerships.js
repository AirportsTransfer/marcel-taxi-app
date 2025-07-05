exports.up = function(knex) {
  return knex.schema.createTable('company_partnerships', function(table) {
    table.uuid('id').primary();
    table.uuid('requesting_company_id').notNullable();
    table.uuid('target_company_id').notNullable();
    table.enum('status', ['pending', 'accepted', 'rejected', 'suspended']).defaultTo('pending');
    table.enum('partnership_type', ['bidirectional', 'one_way']).defaultTo('bidirectional');
    table.decimal('commission_rate', 5, 4).defaultTo(0.10); // 10%
    table.json('allowed_services').defaultTo('["ride_sharing"]');
    table.json('coverage_areas').defaultTo('[]');
    table.integer('max_rides_per_day').nullable();
    table.integer('max_rides_per_month').nullable();
    table.boolean('auto_accept_rides').defaultTo(false);
    table.integer('priority').defaultTo(1);
    table.text('notes').nullable();
    table.timestamp('terms_accepted_at').nullable();
    table.timestamp('suspended_at').nullable();
    table.text('suspension_reason').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    // Ensure no duplicate partnerships
    table.unique(['requesting_company_id', 'target_company_id']);
    table.index(['requesting_company_id']);
    table.index(['target_company_id']);
    table.index(['status']);
    table.index(['priority']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('company_partnerships');
};