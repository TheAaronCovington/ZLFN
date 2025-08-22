### Unified JSON Optional Fields (Quality Enhancements)

Your current JSON is sufficient for ZLFN/STN/ATN once the synthesis/mapping is implemented. The following optional fields improve accuracy, labeling, and overlays.

#### Node-level (improves ATN roles and UI facets)
```json
{
  "nodes": [
    {
      "id": "c1",
      "name": "Main claim",
      "symbolic": "C",
      "type": "conclusion",
      "role": "claim",
      "facets": {
        "vennRelevant": true,
        "truthTableRelevant": false,
        "timelineRelevant": false,
        "rebuttalRelevant": true,
        "noteRelevant": true
      }
    }
  ]
}
```

- `role` (string): "claim" | "ground" | "warrant" | "backing" | "qualifier" | "rebuttal"
- `facets` (object): switches for view affordances in ATN/inspector.

#### Edge-level (improves schemes/strength overlays)
```json
{
  "dependencies": [
    {
      "sourceId": "p1",
      "targetId": "c1",
      "type": "support",
      "rule": "Modus Ponens",
      "scheme": "Evidence to Claim",
      "weight": 85,
      "confidence": 0.85
    }
  ]
}
```

- `scheme` (string): readable label for clustering/legend.
- `confidence`/`strength` (number): used for overlays; will default from `weight` if absent.

#### Document-level hints (improves STN synthesis)
```json
{
  "core": {
    "name": "Argument name",
    "summary": "Short description"
  },
  "conclusionHint": ["c1"]
}
```

- `conclusionHint` (string|string[]): node id(s) that should be preferred as conclusion when synthesizing formulas.

#### Expression override (bypasses synthesis)
```json
{
  "expressions": ["(P ∧ Q) → R"]
}
```

- `expressions`: provide a full formula for STN; we’ll parse it directly instead of synthesizing from edges.

#### Minimal viable JSON (still works with synthesis/mapping)
```json
{
  "arguments": [
    {
      "core": { "name": "Demo", "summary": "Example" },
      "zones": [
        {
          "name": "Formal",
          "range": { "xMin": -200, "xMax": 200 },
          "nodes": [
            { "id": "p1", "name": "Premise 1", "symbolic": "P", "type": "premise" },
            { "id": "p2", "name": "Premise 2", "symbolic": "Q", "type": "premise" },
            { "id": "c1", "name": "Conclusion", "symbolic": "R", "type": "conclusion" }
          ]
        }
      ],
      "dependencies": [
        { "sourceId": "p1", "targetId": "c1", "type": "support", "rule": "modus ponens", "weight": 80 },
        { "sourceId": "p2", "targetId": "c1", "type": "support", "rule": "modus ponens", "weight": 75 }
      ]
    }
  ]
}
```

#### Notes
- None of the optional fields are required; they improve fidelity and UX.
- If both `expressions` and edges exist, `expressions[0]` takes precedence for STN.
- Absent `scheme`/`confidence`, we derive from `rule` and `weight`.


