import type { ExportOptions } from '../components/Export/ExportDialog';
import type { ZLFNObject } from '../types/zlfn';

// Note: These interfaces would be used for a simpler data structure
// Currently using the ZLFNStructure format with arguments

interface ExportData {
  object: ZLFNObject;
  svgElement?: SVGSVGElement;
}

// Tableau-specific interfaces
export interface TableauNode {
  id: string;
  label: string;
  type: 'root' | 'open' | 'closed' | 'intermediate';
  children?: TableauNode[];
  ast?: any; // AstNodeRec type
  decomposed?: boolean;
}

export interface LatexExportOptions {
  includeProofSteps?: boolean;
  usePackages?: string[];
  documentClass?: string;
}

export interface ProofStep {
  step: number;
  action: string;
  formula: string;
  rule: string;
  justification: string;
  branchStatus: 'open' | 'closed' | 'continuing';
}

export interface ImageExportOptions {
  format: 'png' | 'svg';
  backgroundColor?: string;
  padding?: number;
  filename?: string;
}

class ExportService {
  async exportObject(data: ExportData, options: ExportOptions): Promise<void> {
    const { object, svgElement } = data;
    const { format } = options;

    switch (format) {
      case 'json':
        return this.exportJSON(object, options);
      case 'pdf':
        return this.exportPDF(object, options, svgElement);
      case 'docx':
        return this.exportDOCX(object, options);
      case 'svg':
        return this.exportSVG(svgElement, options);
      case 'png':
        return this.exportPNG(svgElement, options);
      case 'markdown':
        return this.exportMarkdown(object, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async exportJSON(object: ZLFNObject, options: ExportOptions): Promise<void> {
    const exportData: any = {
      id: object.id,
      zflnJson: object.zflnJson
    };

    if (options.includeNotes && object.notes) {
      exportData.notes = object.notes;
    }

    if (options.includeVersionHistory) {
      exportData.versionHistory = object.versionHistory;
    }

    if (options.includeLayout) {
      // Include layout information from the latest version
      const latestVersion = object.versionHistory?.[object.versionHistory.length - 1];
      if (latestVersion?.layout) {
        exportData.layout = latestVersion.layout;
      }
    }

    if (options.includeMetadata) {
      exportData.metadata = object.metadata;
      // Note: markdownContent doesn't exist in current ZLFNObject type
      // exportData.markdownContent = object.markdownContent;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    this.downloadBlob(blob, `${object.id}.json`);
  }

  private async exportMarkdown(object: ZLFNObject, options: ExportOptions): Promise<void> {
    let markdown = `# ${object.id}\n\n`;

    if (options.includeMetadata && object.metadata) {
      markdown += `## Metadata\n\n`;
      markdown += `- **Created:** ${new Date(object.metadata.created).toLocaleString()}\n`;
      markdown += `- **Modified:** ${new Date(object.metadata.modified).toLocaleString()}\n`;
      if (object.metadata.author) {
        markdown += `- **Author:** ${object.metadata.author}\n`;
      }
      // Note: tags property doesn't exist in current ZLFNObject type
      // if (object.metadata.tags?.length) {
      //   markdown += `- **Tags:** ${object.metadata.tags.join(', ')}\n`;
      // }
      markdown += '\n';
    }

    // Note: markdownContent doesn't exist in current ZLFNObject type
    // if (object.markdownContent) {
    //   markdown += `## Content\n\n${object.markdownContent}\n\n`;
    // }

    // Export structure (simplified for now)
    if (object.zflnJson?.arguments?.length) {
      markdown += `## Arguments\n\n`;
      object.zflnJson.arguments.forEach((arg: any, index: number) => {
        markdown += `### Argument ${index + 1}\n\n`;
        if (arg.core?.name) {
          markdown += `- **Name:** ${arg.core.name}\n`;
        }
        if (arg.core?.summary) {
          markdown += `- **Summary:** ${arg.core.summary}\n`;
        }
        markdown += '\n';
      });
    }

    // Export dependencies (relationships)
    if (object.zflnJson?.arguments?.length) {
      const allDependencies: any[] = [];
      object.zflnJson.arguments.forEach((arg: any) => {
        if (arg.dependencies) {
          allDependencies.push(...arg.dependencies);
        }
      });
      
      if (allDependencies.length > 0) {
        markdown += `## Dependencies\n\n`;
        allDependencies.forEach((dep: any) => {
          markdown += `- **${dep.source}** → **${dep.target}**`;
          if (dep.rule) markdown += ` (${dep.rule})`;
          if (dep.context) markdown += `: ${dep.context}`;
          markdown += '\n';
        });
        markdown += '\n';
      }
    }

    if (options.includeVersionHistory && object.versionHistory?.length) {
      markdown += `## Version History\n\n`;
      object.versionHistory.forEach((version: any, index) => {
        markdown += `### Version ${index + 1}\n\n`;
        markdown += `- **Date:** ${new Date(version.timestamp).toLocaleString()}\n`;
        if (version.description) {
          markdown += `- **Description:** ${version.description}\n`;
        }
        markdown += `- **Author:** ${version.author}\n`;
        if (version.changes?.length) {
          markdown += `- **Changes:** ${version.changes.join(', ')}\n`;
        }
        markdown += '\n';
      });
    }

    const blob = new Blob([markdown], { type: 'text/markdown' });
    this.downloadBlob(blob, `${object.id}.md`);
  }

  private async exportSVG(svgElement?: SVGSVGElement, _options?: ExportOptions): Promise<void> {
    if (!svgElement) {
      throw new Error('SVG element is required for SVG export');
    }

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
    
    // Add XML namespace if not present
    clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clonedSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    // Get SVG string
    const svgString = new XMLSerializer().serializeToString(clonedSvg);
    
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    this.downloadBlob(blob, 'zlfn-graph.svg');
  }

  private async exportPNG(svgElement?: SVGSVGElement, options?: ExportOptions): Promise<void> {
    if (!svgElement) {
      throw new Error('SVG element is required for PNG export');
    }

    return new Promise((resolve, reject) => {
      try {
        // Clone and prepare SVG
        const clonedSvg = svgElement.cloneNode(true) as SVGSVGElement;
        clonedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Get dimensions
        const bbox = svgElement.getBBox();
        const width = bbox.width || 800;
        const height = bbox.height || 600;

        // Quality multiplier
        const qualityMultiplier = options?.quality === 'high' ? 2 : options?.quality === 'medium' ? 1.5 : 1;
        const scaledWidth = width * qualityMultiplier;
        const scaledHeight = height * qualityMultiplier;

        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Could not get canvas context');
        }

        // Set background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, scaledWidth, scaledHeight);

        // Create image from SVG
        const svgString = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (blob) {
              this.downloadBlob(blob, 'zlfn-graph.png');
              resolve();
            } else {
              reject(new Error('Failed to create PNG blob'));
            }
          }, 'image/png');
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };

        img.src = url;
      } catch (error) {
        reject(error);
      }
    });
  }

  private async exportPDF(object: ZLFNObject, options: ExportOptions, svgElement?: SVGSVGElement): Promise<void> {
    // For now, create a simple text-based PDF using HTML and print
    // In a full implementation, you'd use a library like jsPDF or Puppeteer
    
    const content = this.generateHTMLContent(object, options, svgElement);
    
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Could not open print window');
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${object.id}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            h1, h2, h3 { color: #333; }
            .metadata { background: #f5f5f5; padding: 10px; border-radius: 5px; }
            .node { border: 1px solid #ddd; margin: 10px 0; padding: 10px; border-radius: 5px; }
            .edge { margin: 5px 0; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          ${content}
          <script>
            window.onload = function() {
              window.print();
              setTimeout(() => window.close(), 1000);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  }

  private async exportDOCX(object: ZLFNObject, options: ExportOptions): Promise<void> {
    // For now, export as RTF which can be opened by Word
    // In a full implementation, you'd use a library like docx or mammoth
    
    let rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}`;
    rtfContent += `\\f0\\fs24 `;
    
    // Title
    rtfContent += `{\\b\\fs32 ${this.escapeRTF(object.id)}}\\par\\par`;
    
    if (options.includeMetadata && object.metadata) {
      rtfContent += `{\\b Metadata}\\par`;
      rtfContent += `Created: ${new Date(object.metadata.created).toLocaleString()}\\par`;
      rtfContent += `Modified: ${new Date(object.metadata.modified).toLocaleString()}\\par`;
      if (object.metadata.author) {
        rtfContent += `Author: ${this.escapeRTF(object.metadata.author)}\\par`;
      }
      rtfContent += `\\par`;
    }

    // Note: markdownContent doesn't exist in current ZLFNObject type
    // if (object.markdownContent) {
    //   rtfContent += `{\\b Content}\\par`;
    //   rtfContent += `${this.escapeRTF(object.markdownContent)}\\par\\par`;
    // }

    // Add arguments content...
    if (object.zflnJson?.arguments?.length) {
      rtfContent += `{\\b Arguments}\\par`;
      object.zflnJson.arguments.forEach((arg: any, index: number) => {
        rtfContent += `{\\b Argument ${index + 1}}\\par`;
        if (arg.core?.name) {
          rtfContent += `Name: ${this.escapeRTF(arg.core.name)}\\par`;
        }
        if (arg.core?.summary) {
          rtfContent += `Summary: ${this.escapeRTF(arg.core.summary)}\\par`;
        }
        rtfContent += `\\par`;
      });
    }

    rtfContent += `}`;

    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    this.downloadBlob(blob, `${object.id}.rtf`);
  }

  private generateHTMLContent(object: ZLFNObject, options: ExportOptions, svgElement?: SVGSVGElement): string {
    let html = `<h1>${this.escapeHTML(object.id)}</h1>`;

    if (options.includeMetadata && object.metadata) {
      html += `<div class="metadata">`;
      html += `<h2>Metadata</h2>`;
      html += `<p><strong>Created:</strong> ${new Date(object.metadata.created).toLocaleString()}</p>`;
      html += `<p><strong>Modified:</strong> ${new Date(object.metadata.modified).toLocaleString()}</p>`;
      if (object.metadata.author) {
        html += `<p><strong>Author:</strong> ${this.escapeHTML(object.metadata.author)}</p>`;
      }
      html += `</div>`;
    }

    // Note: markdownContent doesn't exist in current ZLFNObject type
    // if (object.markdownContent) {
    //   html += `<h2>Content</h2>`;
    //   html += `<div>${this.escapeHTML(object.markdownContent)}</div>`;
    // }

    if (svgElement && options.includeLayout) {
      html += `<h2>Graph Visualization</h2>`;
      html += svgElement.outerHTML;
    }

    return html;
  }

  private escapeHTML(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private escapeRTF(text: string): string {
    return text.replace(/[\\{}]/g, '\\$&');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Tableau-specific export methods
  
  /**
   * Generate LaTeX document for semantic tableau
   */
  generateTableauLatex(
    tableauRoot: TableauNode, 
    expression: string,
    options: LatexExportOptions = {}
  ): string {
    const {
      includeProofSteps = true,
      usePackages = ['amsmath', 'amsfonts', 'amssymb', 'proof', 'bussproofs', 'tikz'],
      documentClass = 'article'
    } = options;

    const lines: string[] = [];
    
    // LaTeX document header
    lines.push(`\\documentclass{${documentClass}}`);
    usePackages.forEach(pkg => {
      lines.push(`\\usepackage{${pkg}}`);
    });
    lines.push('\\usetikzlibrary{trees}');
    lines.push('');
    lines.push('\\begin{document}');
    lines.push('');
    lines.push(`\\title{Semantic Tableau for: $${this.latexifyFormula(expression)}$}`);
    lines.push('\\maketitle');
    lines.push('');
    
    // Generate tableau using tikz
    lines.push('\\begin{figure}[h]');
    lines.push('\\centering');
    lines.push('\\begin{tikzpicture}[');
    lines.push('  level distance=1.5cm,');
    lines.push('  level 1/.style={sibling distance=4cm},');
    lines.push('  level 2/.style={sibling distance=2cm},');
    lines.push('  level 3/.style={sibling distance=1cm}');
    lines.push(']');
    
    // Generate tree structure
    const generateLatexNode = (node: TableauNode): string => {
      const formula = this.latexifyFormula(node.label);
      let nodeStr = `node {$${formula}$}`;
      
      if (node.type === 'closed') {
        nodeStr += ' [fill=red!20]';
      } else if (node.type === 'root') {
        nodeStr += ' [fill=blue!20]';
      }
      
      if (node.children && node.children.length > 0) {
        const childrenStr = node.children.map(child => 
          `child { ${generateLatexNode(child)} }`
        ).join(' ');
        nodeStr += ` ${childrenStr}`;
      }
      
      return nodeStr;
    };
    
    lines.push(`\\${generateLatexNode(tableauRoot)};`);
    lines.push('\\end{tikzpicture}');
    lines.push(`\\caption{Semantic tableau for $${this.latexifyFormula(expression)}$}`);
    lines.push('\\end{figure}');
    lines.push('');
    
    if (includeProofSteps) {
      lines.push('\\section{Proof Steps}');
      lines.push('\\begin{enumerate}');
      
      const addLatexProofSteps = (node: TableauNode) => {
        const formula = this.latexifyFormula(node.label);
        lines.push(`\\item $${formula}$`);
        
        if (node.children && node.children.length > 0) {
          node.children.forEach(child => addLatexProofSteps(child));
        }
        
        if (node.type === 'closed') {
          lines.push('\\item[$\\bot$] Contradiction - branch closes');
        }
      };
      
      addLatexProofSteps(tableauRoot);
      lines.push('\\end{enumerate}');
    }
    
    lines.push('');
    lines.push('\\end{document}');
    
    return lines.join('\n');
  }

  /**
   * Export tableau as LaTeX file
   */
  exportTableauLatex(
    tableauRoot: TableauNode,
    expression: string,
    options: LatexExportOptions = {}
  ): void {
    const latexContent = this.generateTableauLatex(tableauRoot, expression, options);
    const filename = `tableau-${expression.replace(/[^a-zA-Z0-9]/g, '_')}.tex`;
    
    const blob = new Blob([latexContent], { type: 'text/plain' });
    this.downloadBlob(blob, filename);
  }

  /**
   * Export tableau as image (PNG or SVG)
   */
  async exportTableauImage(
    svgElement: SVGSVGElement,
    options: ImageExportOptions
  ): Promise<void> {
    const {
      format,
      backgroundColor = '#1a1a1a',
      padding = 50,
      filename
    } = options;

    // Clone the SVG to avoid modifying the original
    const clonedSvg = svgElement.cloneNode(true) as SVGElement;
    
    // Set background for better visibility in exports
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', backgroundColor);
    clonedSvg.insertBefore(rect, clonedSvg.firstChild);
    
    // Get the bounding box and set proper dimensions
    const bbox = svgElement.getBBox();
    clonedSvg.setAttribute('width', String(bbox.width + padding * 2));
    clonedSvg.setAttribute('height', String(bbox.height + padding * 2));
    clonedSvg.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`);
    
    const defaultFilename = filename || `tableau-export.${format}`;
    
    if (format === 'svg') {
      // Direct SVG export
      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      this.downloadBlob(blob, defaultFilename);
    } else {
      // PNG export via canvas
      return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        const img = new Image();
        const svgData = new XMLSerializer().serializeToString(clonedSvg);
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = () => {
          canvas.width = bbox.width + padding * 2;
          canvas.height = bbox.height + padding * 2;
          ctx.drawImage(img, 0, 0);
          
          canvas.toBlob((blob) => {
            if (blob) {
              this.downloadBlob(blob, defaultFilename);
              resolve();
            } else {
              reject(new Error('Failed to create PNG blob'));
            }
            URL.revokeObjectURL(url);
          }, 'image/png');
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load SVG image'));
        };
        
        img.src = url;
      });
    }
  }

  /**
   * Export proof steps in various formats
   */
  exportProofSteps(
    steps: ProofStep[],
    format: 'json' | 'csv' | 'markdown' | 'html',
    filename?: string
  ): void {
    const defaultFilename = filename || `proof-steps.${format}`;
    
    switch (format) {
      case 'json':
        const jsonContent = JSON.stringify(steps, null, 2);
        const jsonBlob = new Blob([jsonContent], { type: 'application/json' });
        this.downloadBlob(jsonBlob, defaultFilename);
        break;
        
      case 'csv':
        const csvHeader = 'Step,Action,Formula,Rule,Justification,Branch Status\n';
        const csvRows = steps.map(step => 
          `${step.step},"${step.action}","${step.formula}","${step.rule}","${step.justification}","${step.branchStatus}"`
        ).join('\n');
        const csvContent = csvHeader + csvRows;
        const csvBlob = new Blob([csvContent], { type: 'text/csv' });
        this.downloadBlob(csvBlob, defaultFilename);
        break;
        
      case 'markdown':
        let mdContent = '# Proof Steps\n\n';
        mdContent += '| Step | Action | Formula | Rule | Justification | Branch Status |\n';
        mdContent += '|------|--------|---------|------|---------------|---------------|\n';
        steps.forEach(step => {
          mdContent += `| ${step.step} | ${step.action} | \`${step.formula}\` | ${step.rule} | ${step.justification} | ${step.branchStatus} |\n`;
        });
        const mdBlob = new Blob([mdContent], { type: 'text/markdown' });
        this.downloadBlob(mdBlob, defaultFilename);
        break;
        
      case 'html':
        let htmlContent = '<!DOCTYPE html>\n<html>\n<head>\n<title>Proof Steps</title>\n';
        htmlContent += '<style>table{border-collapse:collapse;width:100%;}th,td{border:1px solid #ddd;padding:8px;text-align:left;}th{background-color:#f2f2f2;}</style>\n';
        htmlContent += '</head>\n<body>\n<h1>Proof Steps</h1>\n<table>\n';
        htmlContent += '<tr><th>Step</th><th>Action</th><th>Formula</th><th>Rule</th><th>Justification</th><th>Branch Status</th></tr>\n';
        steps.forEach(step => {
          htmlContent += `<tr><td>${step.step}</td><td>${this.escapeHTML(step.action)}</td><td><code>${this.escapeHTML(step.formula)}</code></td><td>${this.escapeHTML(step.rule)}</td><td>${this.escapeHTML(step.justification)}</td><td>${step.branchStatus}</td></tr>\n`;
        });
        htmlContent += '</table>\n</body>\n</html>';
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        this.downloadBlob(htmlBlob, defaultFilename);
        break;
        
      default:
        throw new Error(`Unsupported proof steps format: ${format}`);
    }
  }

  /**
   * Helper to convert logical formulas to LaTeX
   */
  private latexifyFormula(formula: string): string {
    return formula
      .replace(/¬/g, '\\neg ')
      .replace(/∧/g, ' \\land ')
      .replace(/∨/g, ' \\lor ')
      .replace(/→/g, ' \\rightarrow ')
      .replace(/↔/g, ' \\leftrightarrow ')
      .replace(/∀/g, '\\forall ')
      .replace(/∃/g, '\\exists ')
      .replace(/⊻/g, ' \\oplus ')
      .replace(/⊥/g, '\\bot');
  }

  /**
   * Unified download helper for all export types
   */
  downloadFile(content: string | Blob, filename: string, mimeType?: string): void {
    let blob: Blob;
    
    if (content instanceof Blob) {
      blob = content;
    } else {
      blob = new Blob([content], { type: mimeType || 'text/plain' });
    }
    
    this.downloadBlob(blob, filename);
  }
}

export const exportService = new ExportService();
export default exportService;
