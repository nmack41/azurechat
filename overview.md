# Project Overview: Azure Chat Solution Accelerator

This document provides a high-level overview of the Azure Chat Solution Accelerator project, intended to help new developers get up to speed quickly.

## 1. Project Purpose

The project is an _Azure Chat Solution Accelerator powered by Azure OpenAI Service_. It allows organizations to deploy a private chat tenant within their Azure Subscription. Key benefits include:

- **Private**: Deployed entirely within your Azure tenancy.
- **Controlled**: Network traffic can be isolated, and enterprise-grade authentication features are built-in.
- **Value**: Enables business value through integration with internal data sources and services.

## 2. High-Level Architecture

- **Frontend**: A Next.js (TypeScript) application located in the `src/` directory. It uses Tailwind CSS for styling.
- **Azure Services**:
  - Azure App Service: Hosts the frontend application.
  - Azure OpenAI Service: Powers the core chat functionality.
  - Azure AI Document Intelligence (formerly Form Recognizer): Likely used for processing documents for "chat over data" features.
  - Azure Cosmos DB: Serves as the primary database.
  - Azure Monitor: For logging and monitoring application performance.
  - Azure AI Search (formerly Azure Cognitive Search): Used for indexing and searching data, likely for the "chat over file" feature.
- **Infrastructure as Code (IaC)**: Azure resources are provisioned using Bicep templates located in the `infra/` directory.

## 3. Key Features

- Private and controlled chat environment.
- Chatting over your own data and files.
- Customizable personas for the chat assistant.
- Extensibility for integration with other services.
- Managed Identity-based security.

## 4. Getting Started

### Prerequisites

- [Azure Developer CLI (azd)](https://learn.microsoft.com/en-us/azure/developer/azure-developer-cli/overview)

### Local Setup

1.  Clone the repository.
2.  Initialize the project with `azd init` from the root directory.
3.  Refer to `docs/2-run-locally.md` for detailed instructions on running the application locally.
4.  Utility scripts in the `scripts/` directory (e.g., `appreg_setup.ps1`/`.sh`, `add_localdev_roles.ps1`/`.sh`) can assist with setting up app registration and local development roles.

### Deployment to Azure

1.  The primary method for deployment is using the Azure Developer CLI: `azd up`. This command provisions Azure resources and deploys the application.
2.  Refer to `docs/4-deploy-to-azure.md` for comprehensive deployment instructions, including using GitHub Actions.
3.  An alternative is to use the "Deploy to Azure" button in the `README.md` for resource provisioning, followed by application deployment steps.

### Identity Configuration

- The application requires an identity provider to be configured. Follow the instructions in `docs/3-add-identity.md`. This is a crucial step mentioned in `azure.yaml` and the `README.md`.

## 5. Project Structure

- `.azure/`: Contains Azure Developer CLI environment configuration.
- `.devcontainer/`: Configuration for developing in a containerized environment.
- `.github/`: GitHub Actions workflows and issue templates.
- `docs/`: Contains detailed documentation on various aspects of the project.
- `infra/`: Bicep files (`main.bicep`, `resources.bicep`) for Azure infrastructure provisioning.
- `scripts/`: Helper scripts for common tasks like app registration and role assignments.
- `src/`: The frontend Next.js application.
  - `src/app/`: Core application logic and UI components (using Next.js App Router).
  - `src/public/`: Static assets.
  - `src/features/`: Likely contains feature-specific modules.
  - `package.json`: Project dependencies and scripts.
  - `next.config.js`: Next.js configuration.
  - `tailwind.config.ts`: Tailwind CSS configuration.

## 6. Important Files

- `README.md`: The main entry point for understanding the project, including setup and deployment options.
- `azure.yaml`: Defines the Azure services and configuration for the Azure Developer CLI.
- `infra/main.bicep`: The main Bicep file for orchestrating Azure resource deployment.
- `src/package.json`: Lists frontend dependencies and scripts for building/running the Next.js app.
- `docs/`: This directory is your primary resource for in-depth information. Key documents include:
  - `docs/1-introduction.md`: Solution overview.
  - `docs/2-run-locally.md`: Guide for local setup.
  - `docs/3-add-identity.md`: Instructions for setting up authentication.
  - `docs/4-deploy-to-azure.md`: Detailed deployment guide.
  - `docs/9-managed-identities.md`: Information on using Managed Identities for security.

## 7. Documentation

The `docs/` directory contains extensive documentation. It is highly recommended to familiarize yourself with these documents. They cover:

- Introduction and Solution Overview
- Running Locally
- Adding Identity Provider (Authentication)
- Deploying to Azure (including GitHub Actions)
- Chatting with your files
- Personas
- Extensions
- Environment Variables
- Managed Identity-based deployment
- Migration considerations

## 8. Contribution Guidelines

Refer to `CONTRIBUTING.md` for guidelines on contributing to this project.
Refer to `SECURITY.md` for reporting security vulnerabilities.
Refer to `SUPPORT.md` for support information.

This overview should provide a solid foundation for understanding the project. Please refer to the linked documents and explore the codebase for more details.
