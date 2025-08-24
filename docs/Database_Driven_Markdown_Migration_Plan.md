# Database-Driven Markdown Migration Plan

## Overview

This document outlines the transition from a static asset-based Markdown workflow to a database-driven system with user-imported Markdown files for the ZLFN logic visualization application.

## Current State Analysis

### Existing Issues Identified
1. **ObjectForm**: `initialData` logic assumes `markdown.content` in JSON imports; needs separate handling
2. **ArgumentNormalizer**: Contains unnecessary `documentContent` and `normalizeDocument` functions
3. **LogicSharedContext**: `loadMarkdownDocument` calls `normalizeDocument` creating unwanted `zlfnGraph`
4. **ZLFNObject Model**: Mismatch between `markdownContent` (model) and `markdown` (form/context)
5. **Routes**: Backend expects `markdownContent`/`zlfnJson`; form needs adjustment
6. **DocumentParser**: `parseDocumentToGraph` generates unwanted `zlfnGraph` in default workflow

### Target Architecture

#### Data Model (`ZLFNObject`)
- **`markdownContent`**: Raw Markdown text for display in `DocumentViewer`
- **`zlfnJson`**: Structured argument data with `arguments` array for ZLFN/ATN visualizations
- **Separation of Concerns**: No automatic Markdown-to-JSON conversion

#### Workflow
1. **Markdown Import**: Stores content in `markdownContent` field
2. **JSON Import**: Populates `zlfnJson.arguments` independently
3. **Display**: `DocumentViewer` renders `markdownContent`; visualizations use `zlfnJson`
4. **Routing**: Dynamic routes created from imported filenames (e.g., `/new_critique`)

## Implementation Phases

### Phase 1: ObjectForm Enhancement (High Priority)
**Objective**: Modify ObjectForm to handle separate Markdown and JSON imports with dynamic routing

**Key Changes**:
- Add file import handlers for both Markdown (.md) and JSON (.json) files
- Set document ID from filename during Markdown import
- Separate `markdownContent` and `zlfnJson` state management
- Update form submission to create routable pages
- Add proper validation and error handling

**Files Modified**:
- `src/components/InputForm/ObjectForm.tsx`

**Testing Requirements**:
- Import `new_critique.md`, submit, verify `/new_critique` route creation
- Import JSON file, verify `zlfnJson.arguments` population
- Test form validation and error states

### Phase 2: Backend Route Updates (High Priority)
**Objective**: Ensure backend supports dynamic Markdown access and proper object creation

**Key Changes**:
- Update `GET /:id` to serve `markdownContent` for dynamic routes
- Modify `POST` endpoint for new object creation with proper field handling
- Add proper authentication and validation
- Implement conflict detection for duplicate IDs

**Files Modified**:
- `backend/src/routes/zlfn.js`

**Testing Requirements**:
- Access `/new_critique`, verify `markdownContent` retrieval
- Create new object via API, verify route accessibility
- Test authentication and permission handling

### Phase 3: DocumentViewer Database Integration (High Priority)
**Objective**: Replace static asset loading with database-driven content retrieval

**Key Changes**:
- Modify `useEffect` to fetch content via API instead of static assets
- Add route validation and error handling
- Implement proper loading states and user feedback
- Add navigation fallbacks for invalid routes

**Files Modified**:
- `src/components/DocumentViewer/DocumentViewer.tsx`
- `src/App.tsx` (routing updates)

**Testing Requirements**:
- Navigate to `/nonexistent`, verify redirect to `/`
- Access valid document route, verify content display
- Test loading states and error handling

### Phase 4: Context and State Management Updates (High Priority)
**Objective**: Align LogicSharedContext with new database-driven workflow

**Key Changes**:
- Update `loadMarkdownDocument` to handle database-stored content
- Remove unnecessary `normalizeDocument` calls
- Ensure proper state management for `unifiedData`
- Maintain compatibility with existing visualization components

**Files Modified**:
- `src/context/LogicSharedContext.tsx`

**Testing Requirements**:
- Load document via API, verify `unifiedData` updates
- Test state persistence and argument selection
- Verify visualization component compatibility

### Phase 5: Service Layer Refactoring (Medium Priority)
**Objective**: Remove static asset dependencies and implement API-based document services

**Key Changes**:
- Replace `src/assets/documents` dependency in `docs.ts`
- Implement API-based document listing and content retrieval
- Update document metadata handling
- Remove deprecated asset-based functions

**Files Modified**:
- `src/services/docs.ts`
- Remove dependencies on `src/assets/documents`

**Testing Requirements**:
- List documents via API, verify metadata accuracy
- Fetch document content, verify proper formatting
- Test error handling for missing documents

### Phase 6: Testing and Validation (High Priority)
**Objective**: Comprehensive testing of the new workflow

**Key Changes**:
- Create unit tests for ObjectForm import functionality
- Add integration tests for API-based document services
- Implement end-to-end workflow testing
- Add edge case testing for routing and imports

**Files Created**:
- `tests/components/ObjectForm.test.tsx`
- `tests/services/docs.test.ts`
- Additional test files as needed

**Testing Requirements**:
- Complete workflow test: Import → Submit → Navigate → Display
- Edge case testing for malformed files and invalid routes
- Performance testing for large documents
- Cross-browser compatibility verification

## Risk Assessment

### High Risk Areas
1. **Data Migration**: Existing static documents need migration strategy
2. **Route Conflicts**: Dynamic routes may conflict with existing application routes
3. **Performance**: Database queries for document content may impact load times
4. **User Experience**: File import UX needs to be intuitive and error-resistant

### Mitigation Strategies
1. **Gradual Migration**: Implement fallback mechanisms during transition
2. **Route Validation**: Implement proper route validation and conflict detection
3. **Caching**: Consider implementing content caching for frequently accessed documents
4. **User Feedback**: Provide clear feedback during import and submission processes

## Success Criteria

### Functional Requirements
- [x] Users can import Markdown files and create routable pages
- [x] JSON imports populate visualization data independently
- [x] Dynamic routes serve database-stored content
- [x] Existing visualization functionality remains intact

### Technical Requirements
- [x] Clean separation between `markdownContent` and `zlfnJson`
- [x] Proper error handling and validation
- [x] Scalable database-driven architecture
- [x] Comprehensive test coverage

### User Experience Requirements
- [x] Intuitive import workflow
- [x] Fast content loading and navigation
- [x] Clear error messages and feedback
- [x] Seamless integration with existing features

## Dependencies

### External Dependencies
- MongoDB for document storage
- Existing authentication system
- File upload handling capabilities

### Internal Dependencies
- `realAPI` service for backend communication
- `ZLFNObject` model structure
- Existing routing infrastructure
- `DocumentViewer` component architecture

## Timeline Estimate

- **Phase 1**: 2-3 days (ObjectForm enhancement)
- **Phase 2**: 1-2 days (Backend routes)
- **Phase 3**: 2-3 days (DocumentViewer integration)
- **Phase 4**: 1-2 days (Context updates)
- **Phase 5**: 1-2 days (Service refactoring)
- **Phase 6**: 2-3 days (Testing and validation)

**Total Estimated Time**: 9-15 days

## Next Steps

1. Review and approve this implementation plan
2. Begin with Phase 1 (ObjectForm enhancement) as it's foundational
3. Implement phases sequentially with testing at each stage
4. Monitor for issues and adjust plan as needed
5. Document any deviations or additional requirements discovered during implementation
