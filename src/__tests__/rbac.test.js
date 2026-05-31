const { requireRole, requireMinRole, ROLE_HIERARCHY } = require('../middleware/rbac');

// Minimal mock for express res/next
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

describe('RBAC Middleware', () => {
  describe('requireRole', () => {
    test('allows user with matching role', () => {
      const req  = { user: { role: 'ADMIN' } };
      const res  = mockRes();
      const next = jest.fn();

      requireRole('ADMIN')(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('allows user with any of multiple allowed roles', () => {
      const req  = { user: { role: 'MANAGER' } };
      const res  = mockRes();
      const next = jest.fn();

      requireRole('ADMIN', 'MANAGER')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('rejects user without required role', () => {
      const req  = { user: { role: 'MEMBER' } };
      const res  = mockRes();
      const next = jest.fn();

      requireRole('ADMIN')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('returns 401 when no user is attached', () => {
      const req  = {};
      const res  = mockRes();
      const next = jest.fn();

      requireRole('ADMIN')(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('requireMinRole', () => {
    test('ADMIN passes MANAGER minimum', () => {
      const req  = { user: { role: 'ADMIN' } };
      const res  = mockRes();
      const next = jest.fn();

      requireMinRole('MANAGER')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('MEMBER fails MANAGER minimum', () => {
      const req  = { user: { role: 'MEMBER' } };
      const res  = mockRes();
      const next = jest.fn();

      requireMinRole('MANAGER')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('MEMBER passes MEMBER minimum', () => {
      const req  = { user: { role: 'MEMBER' } };
      const res  = mockRes();
      const next = jest.fn();

      requireMinRole('MEMBER')(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    test('MANAGER passes MEMBER minimum', () => {
      const req  = { user: { role: 'MANAGER' } };
      const res  = mockRes();
      const next = jest.fn();

      requireMinRole('MEMBER')(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('ROLE_HIERARCHY', () => {
    test('MEMBER has lower index than MANAGER', () => {
      expect(ROLE_HIERARCHY.indexOf('MEMBER')).toBeLessThan(ROLE_HIERARCHY.indexOf('MANAGER'));
    });

    test('MANAGER has lower index than ADMIN', () => {
      expect(ROLE_HIERARCHY.indexOf('MANAGER')).toBeLessThan(ROLE_HIERARCHY.indexOf('ADMIN'));
    });
  });
});