const {
  createTaskSchema,
  loginSchema,
  registerSchema,
  transitionTaskSchema,
} = require('../validators/schemas');

describe('Validation Schemas', () => {
  describe('loginSchema', () => {
    test('valid login passes', () => {
      const { error } = loginSchema.validate({ email: 'user@test.com', password: 'pass123' });
      expect(error).toBeUndefined();
    });

    test('missing password fails', () => {
      const { error } = loginSchema.validate({ email: 'user@test.com' });
      expect(error).toBeDefined();
    });

    test('invalid email fails', () => {
      const { error } = loginSchema.validate({ email: 'not-an-email', password: 'pass' });
      expect(error).toBeDefined();
    });
  });

  describe('registerSchema', () => {
    test('valid new org registration passes', () => {
      const { error } = registerSchema.validate({
        email: 'alice@co.com',
        password: 'Password1',
        full_name: 'Alice',
        organization_name: 'Acme',
      });
      expect(error).toBeUndefined();
    });

    test('password without uppercase fails', () => {
      const { error } = registerSchema.validate({
        email: 'alice@co.com',
        password: 'password1',
        full_name: 'Alice',
        organization_name: 'Acme',
      });
      expect(error).toBeDefined();
    });

    test('password without number fails', () => {
      const { error } = registerSchema.validate({
        email: 'alice@co.com',
        password: 'PasswordOnly',
        full_name: 'Alice',
        organization_name: 'Acme',
      });
      expect(error).toBeDefined();
    });

    test('org_name not allowed when joining existing org', () => {
      const { error } = registerSchema.validate({
        email: 'alice@co.com',
        password: 'Password1',
        full_name: 'Alice',
        organization_id: '00000000-0000-0000-0000-000000000001',
        organization_name: 'Acme', // Should be forbidden
      });
      expect(error).toBeDefined();
    });
  });

  describe('createTaskSchema', () => {
    test('minimal valid task passes', () => {
      const { error } = createTaskSchema.validate({ title: 'Build feature X' });
      expect(error).toBeUndefined();
    });

    test('empty title fails', () => {
      const { error } = createTaskSchema.validate({ title: '' });
      expect(error).toBeDefined();
    });

    test('past due_date fails', () => {
      const { error } = createTaskSchema.validate({
        title: 'Test',
        due_date: '2020-01-01',
      });
      expect(error).toBeDefined();
      expect(error.details[0].message).toMatch(/future/);
    });

    test('invalid priority fails', () => {
      const { error } = createTaskSchema.validate({ title: 'Test', priority: 'CRITICAL' });
      expect(error).toBeDefined();
    });

    test('strips unknown fields', () => {
      const { value } = createTaskSchema.validate({ title: "Test", unknown_field: "x" }, { stripUnknown: true });
      expect(value).not.toHaveProperty('unknown_field');
    });
  });

  describe('transitionTaskSchema', () => {
    test('valid transition passes', () => {
      const { error } = transitionTaskSchema.validate({ status: 'IN_PROGRESS' });
      expect(error).toBeUndefined();
    });

    test('invalid status fails', () => {
      const { error } = transitionTaskSchema.validate({ status: 'FLYING' });
      expect(error).toBeDefined();
    });

    test('optional note is accepted', () => {
      const { error } = transitionTaskSchema.validate({ status: 'DONE', note: 'All done!' });
      expect(error).toBeUndefined();
    });
  });
});