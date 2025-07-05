exports.up = function(knex) {
  return knex.schema.createTable('companies', function(table) {
    table.uuid('id').primary();
    table.string('name').notNullable();
    table.string('subdomain').notNullable().unique();
    table.string('email').notNullable().unique();
    table.string('phone').notNullable();
    table.string('address').notNullable();
    table.string('city').notNullable();
    table.string('postal_code').notNullable();
    table.string('country').notNullable().defaultTo('NL');
    table.string('vat_number').nullable();
    table.string('chamber_of_commerce').nullable();
    table.string('website').nullable();
    table.text('description').nullable();
    table.string('logo_url').nullable();
    table.string('primary_color').defaultTo('#1976d2');
    table.string('secondary_color').defaultTo('#ffffff');
    table.json('settings').defaultTo('{}');
    table.json('rate_card').defaultTo('{}');
    table.json('features').defaultTo('[]');
    table.boolean('is_active').defaultTo(true);
    table.boolean('is_verified').defaultTo(false);
    table.string('subscription_plan').defaultTo('basic');
    table.timestamp('subscription_expires_at').nullable();
    table.decimal('monthly_fee', 10, 2).defaultTo(0);
    table.decimal('commission_rate', 5, 4).defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    
    table.index(['email']);
    table.index(['subdomain']);
    table.index(['is_active']);
    table.index(['subscription_plan']);
    table.index(['country']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('companies');
};