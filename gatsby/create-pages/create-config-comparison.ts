import { resolve } from "path";
import type { CreatePagesArgs } from "gatsby";
import { DEFAULT_BUILD_TYPE } from "./interface";
import { BuildType } from "../../src/shared/interface";

export const createConfigComparison = async ({
  actions: { createPage },
}: CreatePagesArgs) => {
  const template = resolve(
    __dirname,
    "../../src/templates/ConfigComparisonTemplate.tsx"
  );

  createPage({
    path: "/config-comparison/",
    component: template,
    context: {
      buildType: (process.env.WEBSITE_BUILD_TYPE ??
        DEFAULT_BUILD_TYPE) as BuildType,
      feature: {
        banner: false,
      },
    },
  });
};
