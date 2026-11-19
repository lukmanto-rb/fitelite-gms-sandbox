import config from '../vite.config';

describe('build config', () => {
  it('uses relative asset paths so the release works under /FIT-997/', () => {
    expect(config).toMatchObject({ base: './' });
  });
});
