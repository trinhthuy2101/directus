module.exports = {
	async up(knex) {
		await knex.schema.alterTable('students_classes', (table) => {
      table.unique(['student', 'class'])
		});
	},
};
