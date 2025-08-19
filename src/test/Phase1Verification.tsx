/**
 * Phase 1 Verification Component
 * Simple test interface to verify all Phase 1 functionality
 */

import { useState } from 'react';
import { Box, Typography, Button, Paper, Alert, Chip } from '@mui/material';
import { zlfnObjectManager } from '../services/zlfnObjectManager';
import { api } from '../services/zlfnAPI';
import { createEmptyZLFNStructure } from '../types/zlfn';
import type { ZLFNObject } from '../types/zlfn';

export function Phase1Verification() {
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});
  const [testObject, setTestObject] = useState<ZLFNObject | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const log = (test: string, success: boolean, details?: string) => {
    console.log(`✅ Test: ${test} - ${success ? 'PASSED' : 'FAILED'}`, details || '');
    setTestResults(prev => ({ ...prev, [test]: success }));
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    
    try {
      // Test 1: Object Manager Creation
      console.log("🧪 Starting Phase 1 Verification Tests...");
      
      // Test Object Creation
      const testMarkdown = `# Verification Test Argument
## Premise 1
If P then Q.

\`\`\`expression
P → Q
\`\`\`

## Premise 2
P is true.

## Conclusion
Therefore Q.`;

      const testJson = createEmptyZLFNStructure();
      testJson.arguments[0].core.name = "Verification Test";
      testJson.arguments[0].zones[0].nodes = [
        {
          id: "P1",
          name: "If P then Q",
          symbolic: "P → Q",
          translation: "P implies Q",
          type: "premise",
          vennRelevant: true,
          timelineRelevant: false,
          facets: ["conditional"]
        },
        {
          id: "P2", 
          name: "P is true",
          symbolic: "P",
          translation: "P",
          type: "premise",
          vennRelevant: true,
          timelineRelevant: false,
          facets: ["atomic"]
        },
        {
          id: "C1",
          name: "Therefore Q",
          symbolic: "Q",
          translation: "Q",
          type: "conclusion",
          vennRelevant: true,
          timelineRelevant: false,
          facets: ["derived"]
        }
      ];

      // Test 1: Object Creation
      const createdObject = await zlfnObjectManager.createObject(testMarkdown, testJson);
      log("Object Creation", !!createdObject, `Created object with ID: ${createdObject.id}`);
      setTestObject(createdObject);

      // Test 2: Object Retrieval
      const retrievedObject = await zlfnObjectManager.getObject(createdObject.id);
      log("Object Retrieval", !!retrievedObject && retrievedObject.id === createdObject.id);

      // Test 3: Markdown Update
      const updatedMarkdown = testMarkdown + "\n\n## Additional Note\nThis is an update.";
      const updatedObject = await zlfnObjectManager.updateMarkdown(createdObject.id, updatedMarkdown);
      log("Markdown Update", !!updatedObject && updatedObject.markdown.includes("Additional Note"));

      // Test 4: Notes System
      const notesSaved = await zlfnObjectManager.saveNote(createdObject.id, "P1", "This is a test note for P1");
      log("Notes Creation", notesSaved);

      const objectWithNotes = await zlfnObjectManager.getObject(createdObject.id);
      log("Notes Retrieval", !!(objectWithNotes?.notes["P1"] === "This is a test note for P1"));

      // Test 5: Version Control
      const versions = await zlfnObjectManager.getVersionHistory(createdObject.id);
      log("Version History", versions.length >= 2, `Found ${versions.length} versions`);

      // Test 6: API Layer
      const apiResponse = await api.getObject(createdObject.id);
      log("API Service", apiResponse.success && !!apiResponse.data);

      // Test 7: JSON Merge
      const newJson = createEmptyZLFNStructure();
      newJson.arguments[0].zones[0].nodes = [
        {
          id: "NEW1",
          name: "New test node",
          symbolic: "NEW",
          translation: "New node",
          type: "premise",
          vennRelevant: false,
          timelineRelevant: false,
          facets: ["test"]
        }
      ];

      const mergeResult = await zlfnObjectManager.updateJSON(createdObject.id, newJson, {
        strategy: 'merge',
        preserveNotes: true,
        validateStructure: true,
        createBackup: true
      });
      log("JSON Merge", mergeResult.success, `Merged ${mergeResult.mergedArguments} arguments`);

      // Test 8: Export
      const exportData = await zlfnObjectManager.exportObject(createdObject.id, 'full');
      log("Export Functionality", !!exportData && exportData.length > 0);

      // Test 9: Search
      const searchResults = zlfnObjectManager.searchObjects("Verification Test");
      log("Search Functionality", searchResults.length > 0, `Found ${searchResults.length} results`);

      console.log("🎉 All Phase 1 verification tests completed!");
      
    } catch (error) {
      console.error("❌ Verification failed:", error);
      log("Overall Test Suite", false, error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsRunning(false);
    }
  };

  const testCount = Object.keys(testResults).length;
  const passedCount = Object.values(testResults).filter(Boolean).length;
  const allPassed = testCount > 0 && passedCount === testCount;

  return (
    <Box sx={{ p: 3, maxWidth: 800, margin: '0 auto' }}>
      <Typography variant="h4" gutterBottom sx={{ color: '#40c4ff', fontWeight: 600 }}>
        🧪 Phase 1 Verification Suite
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 3, color: '#b0bec5' }}>
        This verification suite tests all Phase 1 ZLFN enhancements including object management, 
        notes system, version control, and API functionality.
      </Typography>

      <Paper sx={{ p: 2, mb: 3, bgcolor: 'rgba(64, 196, 255, 0.1)', border: '1px solid rgba(64, 196, 255, 0.3)' }}>
        <Typography variant="h6" gutterBottom>Test Status</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip 
            label={`Tests Run: ${testCount}`} 
            color="info" 
          />
          <Chip 
            label={`Passed: ${passedCount}`} 
            color={passedCount > 0 ? "success" : "default"} 
          />
          <Chip 
            label={`Failed: ${testCount - passedCount}`} 
            color={testCount - passedCount > 0 ? "error" : "default"} 
          />
          {testCount > 0 && (
            <Chip 
              label={allPassed ? "ALL TESTS PASSED" : "SOME TESTS FAILED"} 
              color={allPassed ? "success" : "error"}
              variant="filled"
            />
          )}
        </Box>
        
        <Button
          variant="contained"
          onClick={runAllTests}
          disabled={isRunning}
          sx={{ mr: 2 }}
        >
          {isRunning ? 'Running Tests...' : 'Run All Tests'}
        </Button>
        
        {testObject && (
          <Chip 
            label={`Test Object: ${testObject.id}`} 
            color="secondary" 
            size="small"
          />
        )}
      </Paper>

      {/* Test Results */}
      {Object.keys(testResults).length > 0 && (
        <Paper sx={{ p: 2, bgcolor: 'rgba(46, 46, 46, 0.8)' }}>
          <Typography variant="h6" gutterBottom>Detailed Results</Typography>
          {Object.entries(testResults).map(([test, passed]) => (
            <Alert 
              key={test} 
              severity={passed ? "success" : "error"} 
              sx={{ mb: 1 }}
            >
              <strong>{test}</strong>: {passed ? "PASSED" : "FAILED"}
            </Alert>
          ))}
        </Paper>
      )}

      {/* Manual Test Instructions */}
      <Paper sx={{ p: 2, mt: 3, bgcolor: 'rgba(0, 230, 118, 0.1)', border: '1px solid rgba(0, 230, 118, 0.3)' }}>
        <Typography variant="h6" gutterBottom sx={{ color: '#00e676' }}>
          📋 Manual Verification Checklist
        </Typography>
        <Typography variant="body2" component="div" sx={{ color: '#b0bec5' }}>
          After running automated tests, verify these manually:
          <ul>
            <li>Check browser console for detailed test logs</li>
            <li>Verify no TypeScript errors in the console</li>
            <li>Test file upload by creating a .json file and importing</li>
            <li>Verify notes auto-save functionality</li>
            <li>Test version control limits (create 25+ versions)</li>
            <li>Test conflict resolution with duplicate IDs</li>
            <li>Verify memory usage is reasonable</li>
            <li>Test with large markdown files (&gt;1MB)</li>
          </ul>
        </Typography>
      </Paper>
    </Box>
  );
}

export default Phase1Verification;
