# Jira Integration Setup

This document explains how to set up Jira integration for the AI Red Team Dashboard.

## Prerequisites

1. A Jira account with API access
2. A Jira project where tickets will be created
3. API token from Atlassian

## Configuration

### 1. Get Your Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Give it a name (e.g., "AI Red Team Dashboard")
4. Copy the token (you won't be able to see it again)

### 2. Configure Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```bash
JIRA_SERVER=https://your-company.atlassian.net
JIRA_USERNAME=your-email@company.com
JIRA_API_TOKEN=your-api-token-here
JIRA_PROJECT_KEY=PROJ
```

Replace the values with your actual Jira configuration:
- `JIRA_SERVER`: Your Jira instance URL
- `JIRA_USERNAME`: Your Jira email address
- `JIRA_API_TOKEN`: The API token you created
- `JIRA_PROJECT_KEY`: The key of the project where tickets will be created

### 3. Install Dependencies

The required Python packages are already listed in `backend/requirements.txt`:
- `atlassian-python-api==3.41.11`
- `requests==2.31.0`

### 4. Restart the Backend

After setting up the environment variables, restart the backend server:

```bash
cd backend
source venv_py312/bin/activate
python3 main.py
```

## How It Works

### Automatic Ticket Creation

When security findings are discovered during scans, users can create Jira tickets directly from the Findings page:

1. Go to the Findings page (`/findings`)
2. Click the "Create JIRA Ticket" button on any finding
3. A ticket will be automatically created in your configured Jira project

### Ticket Details

Each ticket includes:
- **Summary**: "Security Finding: [Finding Title]"
- **Description**: Detailed information about the vulnerability
- **Priority**: Mapped from finding severity (Critical → Highest, High → High, etc.)
- **Issue Type**: "Bug" (configurable)
- **Labels**: Includes the tool name that discovered the finding

### Fallback Behavior

If Jira is not configured or the API is unavailable, the system will:
1. Create a mock ticket with an ID like "AIRSEC-XXXX"
2. Show a note indicating Jira is not configured
3. Still allow the workflow to continue

## Testing the Integration

### Check Configuration Status

You can verify the Jira configuration by:

1. Looking at the backend logs when the server starts
2. Making a test API call to `/api/jira/status`

### Create a Test Ticket

1. Run a security scan to generate findings
2. Go to the Findings page
3. Click "Create JIRA Ticket" on any finding
4. Check your Jira project for the new ticket

## Troubleshooting

### Common Issues

1. **"Jira not configured"**: Check that all environment variables are set correctly
2. **"Connection Failed"**: Verify your API token is valid and hasn't expired
3. **"Project not found"**: Ensure the `JIRA_PROJECT_KEY` matches an existing project
4. **Permission errors**: Make sure your Jira user has permission to create issues in the project

### Debug Mode

Check the backend logs for detailed error messages when Jira operations fail.

## Security Notes

- API tokens should be treated like passwords
- Store the `.env` file securely and never commit it to version control
- Use environment-specific configurations for different deployment environments