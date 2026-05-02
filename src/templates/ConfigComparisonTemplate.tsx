import * as React from "react";
import { graphql } from "gatsby";
import { useI18next } from "gatsby-plugin-react-i18next";

import "styles/docTemplate.css";

import Layout from "components/Layout";
import Seo from "components/Seo";
import ConfigComparison from "components/ConfigComparison/ConfigComparison";
import { FeedbackSurveyCampaign } from "components/Campaign/FeedbackSurvey";
import { BuildType, Locale, TOCNamespace } from "shared/interface";
import Box from "@mui/material/Box";

interface ConfigComparisonTemplateProps {
  pageContext: {
    buildType: BuildType;
    feature?: {
      banner?: boolean;
    };
  };
}

export default function ConfigComparisonTemplate({
  pageContext: { buildType, feature },
}: ConfigComparisonTemplateProps) {
  const { language } = useI18next();

  return (
    <Layout
      bannerEnabled={feature?.banner}
      buildType={buildType}
      namespace={TOCNamespace.ConfigComparison}
    >
      <Seo
        lang={language as Locale}
        title="Config Comparison"
        description="Compare TiDB system variables and component configuration between versions."
      />
      <ConfigComparison />
      <Box
        sx={{
          width: "fit-content",
          position: "fixed",
          bottom: "1rem",
          right: "1rem",
          zIndex: 9,
        }}
      >
        <FeedbackSurveyCampaign />
      </Box>
    </Layout>
  );
}

export const query = graphql`
  query ($language: String!) {
    locales: allLocale(filter: { language: { eq: $language } }) {
      edges {
        node {
          ns
          data
          language
        }
      }
    }
  }
`;
