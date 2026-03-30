# voteBlob Azure Function

This example Azure Function accepts an HTTP POST with a JSON body `{ game, vote, reason? }` and saves the upvote/downvote as a JSON file into an Azure Storage Blob container named `upvotes`.

Environment:
- `STORAGE_CONNECTION_STRING` or `AzureWebJobsStorage` must be set (connection string for a Storage account).

Example request:

```bash
curl -X POST "http://localhost:7071/api/voteBlob" \
  -H "Content-Type: application/json" \
  -d '{"game":"example-game","vote":"up"}'
```

Response: `{ ok: true, saved: true, path: "<game>/<timestamp>-<user>.json" }`
