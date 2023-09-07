# Artifacts Usage Report

This repository is home to a Proof of Concept (POC) on how to create a "report" of sorts on how artifacts are being used across a GitHub Organization/Enterprise.

## How it works

This POC works by performing the following steps:

- Query the GitHub REST API for all of the repos under an org.
- Iterate over all the repos and query the REST API for any artifacts.
- Create an array of all repos with artifacts, the artifact count, and the total size of all artifacts for each repo.

The array of repos is then saved to file as a JSON and CSV file to be viewed later.
