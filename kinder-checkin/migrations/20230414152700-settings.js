module.exports = {
	async up(knex) {
		await knex.schema.alterTable('settings', (table) => {
      table.unique(['key', 'class'])
		});
	},
};
