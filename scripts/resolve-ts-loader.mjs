export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve);
  } catch (error) {
    if (specifier.startsWith(".") && !/[.]\w+$/.test(specifier)) {
      return defaultResolve(`${specifier}.ts`, context, defaultResolve);
    }
    throw error;
  }
}
