# FastAPI API Documentation

**Base URL:** `http://91.199.227.82:31655`  
**Version:** 0.1.0  
**Interactive Docs:** [Swagger UI](http://91.199.227.82:31655/docs)  
**OpenAPI Spec:** [openapi.json](http://91.199.227.82:31655/openapi.json)

---

## Quick Reference

| Path | Method | Description |
|------|--------|-------------|
| `/extract-zip` | POST | Upload ZIP, create job, run extraction pipeline |
| `/download-file` | GET | Download file by path |
| `/count_files` | POST | Count files by directory and extension |
| `/process-word-documents` | POST | Process Word documents to PDF |
| `/classify-pdfs` | POST | Classify PDFs (text vs drawing) |
| `/extract-text` | POST | Extract text from text PDFs |
| `/extract-competitors` | POST | Extract competitors from texts |
| `/extract-suppliers` | POST | Extract suppliers from texts |
| `/generate-direct-text-json` | POST | Generate JSON from raw text (bypasses summaries) |
| `/generate-direct-csv-json` | POST | Generate JSON from CSV/Excel (bypasses summaries) |
| `/generate-direct-drawing-json` | POST | Generate JSON from drawing PDFs |
| `/convert-excel-to-csv` | POST | Convert Excel to CSV |
| `/run-index-classifier` | POST | Run index classifier |
| `/run-all-class-classifier` | POST | Run all-class classifier |
| `/upload-to-neo4j` | POST | Upload data to Neo4j |
| `/query-neo4j` | POST | Query Neo4j |
| `/execute-cypher` | POST | Execute Cypher query (returns nodes/edges for viz) |
| `/fetch-graph` | POST | Fetch graph data |
| `/generate-launch-notes` | POST | Generate launch notes |
| `/estimate-time` | POST | Estimate processing time |
| `/results/{job_id}` | GET | Get job results |
| `/status/{job_id}` | GET | Get job status |

---

## 1. File Operations

### Extract Zip

Upload a ZIP file, save it, create a job, set deterministic extracted directory in job outputs, and start the background pipeline (only `extract_zip` by default).

| | |
|---|---|
| **Endpoint** | `POST /extract-zip` |
| **Content-Type** | `multipart/form-data` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | binary | Yes | ZIP file to upload |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/extract-zip" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/archive.zip"
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Download File

Download a file from the server by its path.

| | |
|---|---|
| **Endpoint** | `GET /download-file` |

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `file_path` | string | Yes | Path to the file to download |

#### Example Request

```bash
curl -X GET "http://91.199.227.82:31655/download-file?file_path=/outputs/job_123/results.json"
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Count Files

Count files in a directory matching a given extension.

| | |
|---|---|
| **Endpoint** | `POST /count_files` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `dir` | string | Yes | Directory path to scan |
| `ext` | string | Yes | File extension to match (e.g., `.pdf`) |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/count_files" \
  -H "Content-Type: application/json" \
  -d '{"dir": "/outputs/job_123/extracted", "ext": ".pdf"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 2. Document Processing

### Process Word Documents

Convert Word documents to PDF and place in output folder.

| | |
|---|---|
| **Endpoint** | `POST /process-word-documents` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `input_folder` | string | No | Input folder path |
| `output_folder` | string | No | Output folder path |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/process-word-documents" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_abc123"
  }'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Classify PDFs

Classify PDFs as text-based or drawing-based.

| | |
|---|---|
| **Endpoint** | `POST /classify-pdfs` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `input_pdfs_dir` | string | No | Directory containing PDFs to classify |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/classify-pdfs" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_abc123",
    "input_pdfs_dir": "/outputs/job_abc123/extracted"
  }'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Extract Text

Extract text from classified text-based PDFs.

| | |
|---|---|
| **Endpoint** | `POST /extract-text` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `text_pdfs_dir` | string | No | Directory containing text PDFs |
| `extracted_texts_dir` | string | No | Output directory for extracted texts |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/extract-text" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_abc123"
  }'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Extract Competitors

Extract competitor entities from extracted texts.

| | |
|---|---|
| **Endpoint** | `POST /extract-competitors` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `extracted_texts_dir` | string | No | Directory containing extracted texts |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/extract-competitors" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Extract Suppliers

Extract supplier entities from extracted texts.

| | |
|---|---|
| **Endpoint** | `POST /extract-suppliers` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `extracted_texts_dir` | string | No | Directory containing extracted texts |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/extract-suppliers" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 3. JSON Generation

### Generate Direct Text JSON

Generate JSON files directly from raw extracted texts (bypasses summaries step).

| | |
|---|---|
| **Endpoint** | `POST /generate-direct-text-json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `extracted_texts_dir` | string | No | Directory containing extracted texts |
| `json_dir` | string | No | Output directory for JSON files |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/generate-direct-text-json" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Generate Direct CSV JSON

Generate JSON files directly from CSV/Excel files (bypasses summaries step).

| | |
|---|---|
| **Endpoint** | `POST /generate-direct-csv-json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `csvs_dir` | string | No | Directory containing CSV files |
| `csvs_json_dir` | string | No | Output directory for CSV JSON files |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/generate-direct-csv-json" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Generate Direct Drawing JSON

Process drawing PDFs and generate JSON directly (bypasses text summaries step).

| | |
|---|---|
| **Endpoint** | `POST /generate-direct-drawing-json` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `drawing_pdfs_dir` | string | No | Directory containing drawing PDFs |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/generate-direct-drawing-json" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 4. Data Conversion

### Convert Excel to CSV

Convert Excel files to CSV format.

| | |
|---|---|
| **Endpoint** | `POST /convert-excel-to-csv` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `extracted_root_folder` | string | No | Root folder containing Excel files |
| `csvs_dir` | string | No | Output directory for CSV files |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/convert-excel-to-csv" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 5. Classification

### Run Index Classifier

Run the index classifier on text and/or PDF content.

| | |
|---|---|
| **Endpoint** | `POST /run-index-classifier` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `text_dir` | string | No | Directory containing text files |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/run-index-classifier" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Run All Class Classifier

Run the all-class classifier on text and CSV data.

| | |
|---|---|
| **Endpoint** | `POST /run-all-class-classifier` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `text_dir` | string | No | Directory containing text files |
| `csvs_dir` | string | No | Directory containing CSV files |
| `main_output_dir` | string | No | Main output directory override |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/run-all-class-classifier" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 6. Neo4j

### Upload to Neo4j

Upload processed data to Neo4j graph database.

| | |
|---|---|
| **Endpoint** | `POST /upload-to-neo4j` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | No | Job identifier |
| `main_output_dir` | string | No | Main output directory |
| `database` | string | No | Neo4j database name (default: `neo4j`) |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/upload-to-neo4j" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_abc123",
    "database": "neo4j"
  }'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Query Neo4j

Execute a natural language or structured query against Neo4j.

| | |
|---|---|
| **Endpoint** | `POST /query-neo4j` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `query` | string | Yes | Query text |
| `show_sources` | boolean | No | Include sources in response (default: `true`) |
| `show_combined` | boolean | No | Include combined results (default: `false`) |
| `database` | string | No | Neo4j database name (default: `neo4j`) |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/query-neo4j" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "List all competitors",
    "show_sources": true
  }'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Execute Cypher

Execute a Cypher query and return nodes and edges for visualization.

| | |
|---|---|
| **Endpoint** | `POST /execute-cypher` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `query` | string | Yes | Cypher query string |
| `database` | string | No | Neo4j database name (default: `neo4j`) |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/execute-cypher" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_abc123",
    "query": "MATCH (n) RETURN n LIMIT 25"
  }'
```

#### Example Response

```json
{
  "nodes": [...],
  "edges": [...]
}
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response (nodes and edges) |
| 422 | Validation Error |

---

### Fetch Graph

Fetch graph data for visualization.

| | |
|---|---|
| **Endpoint** | `POST /fetch-graph` |

#### Request Body

Accepts an arbitrary JSON object (schema: `additionalProperties: true`). Structure depends on implementation.

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/fetch-graph" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 7. Utilities

### Generate Launch Notes

Generate launch notes from processed data.

| | |
|---|---|
| **Endpoint** | `POST /generate-launch-notes` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `main_output_dir` | string | No | Main output directory override |
| `database` | string | No | Neo4j database name (default: `neo4j`) |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/generate-launch-notes" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "job_abc123"}'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Estimate Time

Estimate processing time for a pipeline step.

| | |
|---|---|
| **Endpoint** | `POST /estimate-time` |

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |
| `step` | integer | Yes | Pipeline step number |

#### Example Request

```bash
curl -X POST "http://91.199.227.82:31655/estimate-time" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_abc123",
    "step": 1
  }'
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## 8. Job Management

### Get Results

Retrieve results for a completed job.

| | |
|---|---|
| **Endpoint** | `GET /results/{job_id}` |

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |

#### Example Request

```bash
curl -X GET "http://91.199.227.82:31655/results/job_abc123"
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

### Get Status

Retrieve the current status of a job.

| | |
|---|---|
| **Endpoint** | `GET /status/{job_id}` |

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `job_id` | string | Yes | Job identifier |

#### Example Request

```bash
curl -X GET "http://91.199.227.82:31655/status/job_abc123"
```

#### Responses

| Status | Description |
|--------|-------------|
| 200 | Successful Response |
| 422 | Validation Error |

---

## Appendix A: Request Schemas Reference

### Body_extract_zip_api_extract_zip_post
- `file` (binary, required): ZIP file upload

### ClassifyPdfsRequest
- `job_id` (string, required)
- `input_pdfs_dir` (string, optional)
- `main_output_dir` (string, optional)

### ConvertExcelToCsvRequest
- `job_id` (string, required)
- `extracted_root_folder` (string, optional)
- `csvs_dir` (string, optional)
- `main_output_dir` (string, optional)

### CountFilesRequest
- `dir` (string, required)
- `ext` (string, required)

### CypherQueryRequest
- `job_id` (string, required)
- `query` (string, required)
- `database` (string, optional, default: `neo4j`)

### EstimateTimeRequest
- `job_id` (string, required)
- `step` (integer, required)

### ExtractCompetitorsRequest
- `job_id` (string, required)
- `extracted_texts_dir` (string, optional)
- `main_output_dir` (string, optional)

### ExtractSuppliersRequest
- `job_id` (string, required)
- `extracted_texts_dir` (string, optional)
- `main_output_dir` (string, optional)

### ExtractTextRequest
- `job_id` (string, required)
- `text_pdfs_dir` (string, optional)
- `extracted_texts_dir` (string, optional)
- `main_output_dir` (string, optional)

### GenerateDirectCsvJsonRequest
- `job_id` (string, required)
- `csvs_dir` (string, optional)
- `csvs_json_dir` (string, optional)
- `main_output_dir` (string, optional)

### GenerateDirectDrawingJsonRequest
- `job_id` (string, required)
- `drawing_pdfs_dir` (string, optional)
- `main_output_dir` (string, optional)

### GenerateDirectTextJsonRequest
- `job_id` (string, required)
- `extracted_texts_dir` (string, optional)
- `json_dir` (string, optional)
- `main_output_dir` (string, optional)

### GenerateLaunchNotesRequest
- `job_id` (string, required)
- `main_output_dir` (string, optional)
- `database` (string, optional, default: `neo4j`)

### Neo4jQueryRequest
- `query` (string, required)
- `show_sources` (boolean, optional, default: `true`)
- `show_combined` (boolean, optional, default: `false`)
- `database` (string, optional, default: `neo4j`)

### Neo4jUploadRequest
- `job_id` (string, optional)
- `main_output_dir` (string, optional)
- `database` (string, optional, default: `neo4j`)

### ProcessWordDocumentsRequest
- `job_id` (string, required)
- `input_folder` (string, optional)
- `output_folder` (string, optional)
- `main_output_dir` (string, optional)

### RunAllClassClassifierRequest
- `job_id` (string, required)
- `text_dir` (string, optional)
- `csvs_dir` (string, optional)
- `main_output_dir` (string, optional)

### RunIndexClassifierRequest
- `job_id` (string, required)
- `text_dir` (string, optional)
- `main_output_dir` (string, optional)

---

## Appendix B: Error Responses

### 422 Validation Error

Returned when request body or parameters fail Pydantic validation.

**Response Schema: HTTPValidationError**

```json
{
  "detail": [
    {
      "loc": ["body", "job_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `detail` | array | List of validation errors |
| `detail[].loc` | array | Location of the error (e.g., `["body", "field_name"]` or `["query", "param_name"]`) |
| `detail[].msg` | string | Human-readable error message |
| `detail[].type` | string | Error type identifier |

**ValidationError item schema:**
- `loc`: array of string or integer (path to the error)
- `msg`: string (error message)
- `type`: string (error type)
