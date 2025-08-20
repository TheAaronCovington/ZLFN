/**
 * Performance Optimization Service for ZLFN Graph Visualization
 * Implements DAG pruning, lazy evaluation, and rendering optimizations
 */

import type { ZlfnNode, ZlfnEdge } from '../components/Visualizations/ZlfnGraph';

export interface PerformanceConfig {
  maxVisibleNodes: number;
  maxVisibleEdges: number;
  pruningThreshold: number;
  lazyRenderingThreshold: number;
  simulationCooldownFactor: number;
  levelOfDetailEnabled: boolean;
  frustumCullingEnabled: boolean;
  batchSize: number;
}

export interface OptimizedGraphData {
  visibleNodes: ZlfnNode[];
  visibleEdges: ZlfnEdge[];
  hiddenNodes: ZlfnNode[];
  hiddenEdges: ZlfnEdge[];
  clusters: NodeCluster[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    visibleNodes: number;
    visibleEdges: number;
    optimizationLevel: 'none' | 'light' | 'moderate' | 'aggressive';
    pruningApplied: boolean;
    clusteringApplied: boolean;
  };
}

export interface NodeCluster {
  id: string;
  nodes: ZlfnNode[];
  centroid: { x: number; y: number };
  radius: number;
  importance: number;
  representative?: ZlfnNode;
}

export interface ViewportBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

class PerformanceOptimizer {
  private config: PerformanceConfig = {
    maxVisibleNodes: 500,
    maxVisibleEdges: 1000,
    pruningThreshold: 1000,
    lazyRenderingThreshold: 200,
    simulationCooldownFactor: 0.8,
    levelOfDetailEnabled: true,
    frustumCullingEnabled: true,
    batchSize: 50
  };

  private nodeImportanceCache = new Map<string, number>();
  private clusterCache = new Map<string, NodeCluster>();

  /**
   * Update performance configuration
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.clearCaches();
  }

  /**
   * Optimize graph data based on current viewport and performance settings
   */
  optimizeGraph(
    nodes: ZlfnNode[], 
    edges: ZlfnEdge[], 
    viewport?: ViewportBounds
  ): OptimizedGraphData {
    const totalNodes = nodes.length;
    const totalEdges = edges.length;

    // Determine optimization level based on graph size
    const optimizationLevel = this.getOptimizationLevel(totalNodes, totalEdges);
    
    let optimizedData: OptimizedGraphData = {
      visibleNodes: [...nodes],
      visibleEdges: [...edges],
      hiddenNodes: [],
      hiddenEdges: [],
      clusters: [],
      metadata: {
        totalNodes,
        totalEdges,
        visibleNodes: totalNodes,
        visibleEdges: totalEdges,
        optimizationLevel,
        pruningApplied: false,
        clusteringApplied: false
      }
    };

    // Apply optimizations based on level
    if (optimizationLevel !== 'none') {
      // Step 1: Calculate node importance scores
      this.calculateNodeImportance(nodes, edges);

      // Step 2: Apply DAG pruning if needed
      if (totalNodes > this.config.pruningThreshold) {
        optimizedData = this.applyDAGPruning(optimizedData);
      }

      // Step 3: Apply viewport culling if viewport is provided
      if (viewport && this.config.frustumCullingEnabled) {
        optimizedData = this.applyViewportCulling(optimizedData, viewport);
      }

      // Step 4: Apply clustering for very large graphs
      if (optimizationLevel === 'aggressive') {
        optimizedData = this.applyClustering(optimizedData);
      }

      // Step 5: Apply level of detail optimization
      if (this.config.levelOfDetailEnabled && viewport) {
        optimizedData = this.applyLevelOfDetail(optimizedData, viewport);
      }
    }

    return optimizedData;
  }

  /**
   * Determine optimization level based on graph size
   */
  private getOptimizationLevel(nodeCount: number, edgeCount: number): 'none' | 'light' | 'moderate' | 'aggressive' {
    if (nodeCount < 100 && edgeCount < 200) return 'none';
    if (nodeCount < 500 && edgeCount < 1000) return 'light';
    if (nodeCount < 2000 && edgeCount < 5000) return 'moderate';
    return 'aggressive';
  }

  /**
   * Calculate importance scores for nodes based on connectivity and centrality
   */
  private calculateNodeImportance(nodes: ZlfnNode[], edges: ZlfnEdge[]): void {
    const adjacencyMap = new Map<string, Set<string>>();
    const degreeMap = new Map<string, number>();

    // Build adjacency map and calculate degrees
    nodes.forEach(node => {
      adjacencyMap.set(node.id, new Set());
      degreeMap.set(node.id, 0);
    });

    edges.forEach(edge => {
      const source = edge.from || edge.source;
      const target = edge.to || edge.target;
      if (source && target) {
        adjacencyMap.get(source)?.add(target);
        adjacencyMap.get(target)?.add(source);
        degreeMap.set(source, (degreeMap.get(source) || 0) + 1);
        degreeMap.set(target, (degreeMap.get(target) || 0) + 1);
      }
    });

    // Calculate importance scores (combination of degree centrality and betweenness)
    nodes.forEach(node => {
      const degree = degreeMap.get(node.id) || 0;
      const maxDegree = Math.max(...Array.from(degreeMap.values()));
      const normalizedDegree = maxDegree > 0 ? degree / maxDegree : 0;

      // Simple importance score (can be enhanced with PageRank, betweenness centrality, etc.)
      let importance = normalizedDegree;

      // Boost importance for certain node types
      if (node.type === 'core' || node.centralHub) {
        importance *= 1.5;
      }
      if (node.type === 'conclusion') {
        importance *= 1.3;
      }

      this.nodeImportanceCache.set(node.id, importance);
    });
  }

  /**
   * Apply DAG pruning to reduce graph complexity
   */
  private applyDAGPruning(data: OptimizedGraphData): OptimizedGraphData {
    const { visibleNodes, visibleEdges } = data;
    
    // Sort nodes by importance
    const sortedNodes = visibleNodes
      .map(node => ({
        node,
        importance: this.nodeImportanceCache.get(node.id) || 0
      }))
      .sort((a, b) => b.importance - a.importance);

    // Keep top N most important nodes
    const keepCount = Math.min(this.config.maxVisibleNodes, sortedNodes.length);
    const keptNodeIds = new Set(
      sortedNodes.slice(0, keepCount).map(item => item.node.id)
    );

    // Filter nodes and edges
    const prunedNodes = visibleNodes.filter(node => keptNodeIds.has(node.id));
    const prunedEdges = visibleEdges.filter(edge => {
      const source = edge.from || edge.source;
      const target = edge.to || edge.target;
      return source && target && keptNodeIds.has(source) && keptNodeIds.has(target);
    });

    // Limit edges if still too many
    const finalEdges = prunedEdges.length > this.config.maxVisibleEdges
      ? prunedEdges
          .sort((a, b) => (b.weight || 0) - (a.weight || 0))
          .slice(0, this.config.maxVisibleEdges)
      : prunedEdges;

    return {
      ...data,
      visibleNodes: prunedNodes,
      visibleEdges: finalEdges,
      hiddenNodes: [...data.hiddenNodes, ...visibleNodes.filter(node => !keptNodeIds.has(node.id))],
      hiddenEdges: [...data.hiddenEdges, ...visibleEdges.filter(edge => !finalEdges.includes(edge))],
      metadata: {
        ...data.metadata,
        visibleNodes: prunedNodes.length,
        visibleEdges: finalEdges.length,
        pruningApplied: true
      }
    };
  }

  /**
   * Apply viewport culling to hide nodes outside the visible area
   */
  private applyViewportCulling(data: OptimizedGraphData, viewport: ViewportBounds): OptimizedGraphData {
    const { visibleNodes, visibleEdges } = data;
    const margin = 100; // Extra margin for smooth transitions

    const culledNodes = visibleNodes.filter(node => {
      const nodeX = (node as any).x || 0;
      const nodeY = (node as any).y || 0;
      
      return nodeX >= viewport.x - margin &&
             nodeX <= viewport.x + viewport.width + margin &&
             nodeY >= viewport.y - margin &&
             nodeY <= viewport.y + viewport.height + margin;
    });

    const culledNodeIds = new Set(culledNodes.map(node => node.id));
    const culledEdges = visibleEdges.filter(edge => {
      const source = edge.from || edge.source;
      const target = edge.to || edge.target;
      return source && target && culledNodeIds.has(source) && culledNodeIds.has(target);
    });

    return {
      ...data,
      visibleNodes: culledNodes,
      visibleEdges: culledEdges,
      hiddenNodes: [...data.hiddenNodes, ...visibleNodes.filter(node => !culledNodeIds.has(node.id))],
      hiddenEdges: [...data.hiddenEdges, ...visibleEdges.filter(edge => !culledEdges.includes(edge))],
      metadata: {
        ...data.metadata,
        visibleNodes: culledNodes.length,
        visibleEdges: culledEdges.length
      }
    };
  }

  /**
   * Apply clustering to group nearby nodes
   */
  private applyClustering(data: OptimizedGraphData): OptimizedGraphData {
    const { visibleNodes } = data;
    const clusters: NodeCluster[] = [];
    const clusteredNodeIds = new Set<string>();

    // Simple spatial clustering based on position
    const clusterRadius = 150;
    let clusterId = 0;

    visibleNodes.forEach(node => {
      if (clusteredNodeIds.has(node.id)) return;

      const nodeX = (node as any).x || 0;
      const nodeY = (node as any).y || 0;
      
      // Find nearby nodes
      const nearbyNodes = visibleNodes.filter(otherNode => {
        if (clusteredNodeIds.has(otherNode.id) || otherNode.id === node.id) return false;
        
        const otherX = (otherNode as any).x || 0;
        const otherY = (otherNode as any).y || 0;
        const distance = Math.sqrt((nodeX - otherX) ** 2 + (nodeY - otherY) ** 2);
        
        return distance <= clusterRadius;
      });

      if (nearbyNodes.length >= 2) { // Only cluster if we have at least 3 nodes total
        const clusterNodes = [node, ...nearbyNodes];
        
        // Calculate centroid
        const centroidX = clusterNodes.reduce((sum, n) => sum + ((n as any).x || 0), 0) / clusterNodes.length;
        const centroidY = clusterNodes.reduce((sum, n) => sum + ((n as any).y || 0), 0) / clusterNodes.length;
        
        // Find most important node as representative
        const representative = clusterNodes.reduce((best, current) => {
          const currentImportance = this.nodeImportanceCache.get(current.id) || 0;
          const bestImportance = this.nodeImportanceCache.get(best.id) || 0;
          return currentImportance > bestImportance ? current : best;
        });

        const cluster: NodeCluster = {
          id: `cluster-${clusterId++}`,
          nodes: clusterNodes,
          centroid: { x: centroidX, y: centroidY },
          radius: clusterRadius,
          importance: clusterNodes.reduce((sum, n) => sum + (this.nodeImportanceCache.get(n.id) || 0), 0),
          representative
        };

        clusters.push(cluster);
        clusterNodes.forEach(n => clusteredNodeIds.add(n.id));
      }
    });

    return {
      ...data,
      clusters,
      metadata: {
        ...data.metadata,
        clusteringApplied: clusters.length > 0
      }
    };
  }

  /**
   * Apply level of detail optimization based on zoom level
   */
  private applyLevelOfDetail(data: OptimizedGraphData, viewport: ViewportBounds): OptimizedGraphData {
    const { visibleNodes } = data;
    const scale = viewport.scale;

    // Adjust node detail based on zoom level
    const detailedNodes = visibleNodes.map(node => {
      const detailLevel = this.getDetailLevel(scale);
      
      return {
        ...node,
        _detailLevel: detailLevel,
        _showLabel: detailLevel >= 2,
        _showFacets: detailLevel >= 3,
        _showTooltip: detailLevel >= 1
      };
    });

    return {
      ...data,
      visibleNodes: detailedNodes
    };
  }

  /**
   * Get detail level based on zoom scale
   */
  private getDetailLevel(scale: number): number {
    if (scale < 0.3) return 0; // Minimal detail
    if (scale < 0.7) return 1; // Basic detail
    if (scale < 1.5) return 2; // Normal detail
    return 3; // Full detail
  }

  /**
   * Get optimized simulation parameters based on graph size
   */
  getOptimizedSimulationParams(nodeCount: number, edgeCount: number): {
    alphaTarget: number;
    alphaDecay: number;
    velocityDecay: number;
    iterations: number;
    forces: {
      charge: { strength: number; distanceMax: number };
      link: { distance: number; strength: number };
      collision: { radius: number; strength: number };
    };
  } {
    const optimizationLevel = this.getOptimizationLevel(nodeCount, edgeCount);
    
    const baseParams = {
      alphaTarget: 0,
      alphaDecay: 0.0228,
      velocityDecay: 0.4,
      iterations: 300,
      forces: {
        charge: { strength: -300, distanceMax: 500 },
        link: { distance: 100, strength: 0.1 },
        collision: { radius: 30, strength: 0.7 }
      }
    };

    switch (optimizationLevel) {
      case 'light':
        return {
          ...baseParams,
          alphaDecay: 0.05,
          iterations: 200,
          forces: {
            ...baseParams.forces,
            charge: { strength: -200, distanceMax: 400 }
          }
        };
      
      case 'moderate':
        return {
          ...baseParams,
          alphaDecay: 0.1,
          velocityDecay: 0.6,
          iterations: 150,
          forces: {
            ...baseParams.forces,
            charge: { strength: -150, distanceMax: 300 },
            link: { distance: 80, strength: 0.05 }
          }
        };
      
      case 'aggressive':
        return {
          ...baseParams,
          alphaDecay: 0.2,
          velocityDecay: 0.8,
          iterations: 100,
          forces: {
            ...baseParams.forces,
            charge: { strength: -100, distanceMax: 200 },
            link: { distance: 60, strength: 0.02 },
            collision: { radius: 20, strength: 0.5 }
          }
        };
      
      default:
        return baseParams;
    }
  }

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.nodeImportanceCache.clear();
    this.clusterCache.clear();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(data: OptimizedGraphData): {
    reductionRatio: number;
    memoryUsage: number;
    renderComplexity: number;
    optimizationEffectiveness: number;
  } {
    const { metadata } = data;
    const reductionRatio = metadata.totalNodes > 0 
      ? 1 - (metadata.visibleNodes / metadata.totalNodes)
      : 0;
    
    // Estimate memory usage (simplified)
    const memoryUsage = (metadata.visibleNodes * 200) + (metadata.visibleEdges * 100); // bytes
    
    // Estimate render complexity
    const renderComplexity = metadata.visibleNodes + (metadata.visibleEdges * 0.5);
    
    // Calculate optimization effectiveness
    const optimizationEffectiveness = reductionRatio * 100;

    return {
      reductionRatio,
      memoryUsage,
      renderComplexity,
      optimizationEffectiveness
    };
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();
export default performanceOptimizer;
