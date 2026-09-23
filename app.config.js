module.exports = ({ config }) => {
  const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1];
  const isUserOrOrganizationSite = repositoryName?.toLowerCase().endsWith('.github.io');
  const baseUrl = repositoryName && !isUserOrOrganizationSite ? `/${repositoryName}` : '';

  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(repositoryName ? { baseUrl } : {}),
    },
  };
};
