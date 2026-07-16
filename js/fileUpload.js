export const GFC_EXTENSION_ERROR =
    'The uploaded file should have a .gfc extension!. Change the file extension or copy-paste the text in the free text fields.';

const GFC_HEADER_KEYS = [
    'product_type',
    'modelname',
    'earth_gravity_constant',
    'radius',
    'max_degree',
    'errors',
    'format',
    'tide_system',
];

class Parser {

    checkFile(file) {
        // Instead of mutating instance state (this.fileName), 
        // it's safer to just return the data you need.
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        return { name: fileName, extension: fileExtension };
    }


    readFile(file, maxSizeInMB = 1, strict = true) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (event) => reject(new Error(`Error reading file: ${event.target.error}`));
            
            let blobToRead = file;

            // If a size limit is provided, handle the strict/non-strict logic
            if (maxSizeInMB) {
                const maxBytes = maxSizeInMB * 1024 * 1024;
                
                if (file.size > maxBytes) {
                    if (strict) {
                        // Use reject() inside a Promise instead of throw
                        return reject(new Error(`File size exceeds the limit of ${maxSizeInMB} MB.`));
                    } else {
                        // The magic happens here: gently ignore the rest of the file
                        blobToRead = file.slice(0, maxBytes);
                    }
                }
            }
            
            // readAsText works perfectly on sliced Blobs
            reader.readAsText(blobToRead);
        });
    }
}

class CSVParser extends Parser {
    
    /**
     * Because readFile returns a Promise, we can make this function async
     * and actually return the final array!
     */
    async parseCsvFileIntoKeywords(file) {

        // CHECK
        if (this.checkFile(file)["extension"] !== "csv") {
            throw new Error("Invalid file type. Only CSV files are allowed.");
        }

        // READ
        const text = await this.readFile(file); 
        
        // PARSE
        return text
            .split(/\r?\n|,|;/)
            // Arrow functions make map/filter much cleaner
            .map(value => value.trim())
            .filter(value => value.length > 0);
    }
}

class GFCParser extends Parser {
    constructor() {
        super();
        this.commentSection = "";
        this.header = {};
    }

    validateGfcFileExtension(file) {
        if (!file) {
            return;
        }
        const { extension } = this.checkFile(file);
        if (extension !== 'gfc') {
            throw new Error(GFC_EXTENSION_ERROR);
        }
    }

    /**
     * Main method to read and parse the GFC file.
     * Assumes `this.readFile(file)` returns a Promise (as updated previously).
     * 
     * @param {File} file - The file object from an HTML input
     */
    async parseGfcFiles(file) {
        try {
            this.validateGfcFileExtension(file);

            // 1. Read the file contents as text
            const text = await this.readFile(file, 1, false);
            // 2. Split the text into an array of lines (handling both \r\n and \n)
            const lines = text.split(/\r?\n/);
            
            // 3. Extract the sections
            let { headerLines, commentLines } = this.extractSections(lines);

            // 3.1 Handle the case when the comment is not separated from header
            if (headerLines.length === 0) {
                // parse all lines
                // for each line starting with a known header key, treat as header; otherwise comment
                ({ headerLines, commentLines } = this.extractSectionsByHeaderKeys(lines));
            }

            // 4. Store the results in the class properties
            this.commentSection = commentLines.join("");
            this.header = this.parseRecords(headerLines);

            // Optional: return the data directly for easier usage
            return {
                header: this.header,
                commentSection: this.commentSection
            };

        } catch (error) {
            console.error("Error parsing GFC file:", error);
            throw error;
        }
    }

    extractSections(lines) {
        let commentLines = [];
        let headerLines = [];
        let inHeader = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const strippedLine = line.trim();
            line = line.replace(/={4,}|-{4,}/g, ""); // Remove lines with 4 or more '=' or '-'

            if (strippedLine.startsWith("modelname")) {
                inHeader = true;
                headerLines.push(line);
                continue;
            }
            if (strippedLine.startsWith("begin_of_head")) {
                inHeader = true;
                continue;
            }
            if (strippedLine.startsWith("end_of_head")) {
                break;
            }
            if (strippedLine.startsWith("key")) {
                if (!inHeader) {
                    return this.handleMissingHead(lines);
                }
                continue;
            }

            if (inHeader) {
                headerLines.push(line);
            } else {
                commentLines.push(this.cleanComment(line));
            }
        }

        return { headerLines, commentLines };
    }

    /**
     * Fallback when begin_of_head / end_of_head markers are absent:
     * classify each line by whether it starts with a known GFC header keyword.
     */
    extractSectionsByHeaderKeys(lines) {
        const headerLines = [];
        const commentLines = [];

        for (const line of lines) {
            const strippedLine = line.trim();
            const isHeaderLine = GFC_HEADER_KEYS.some((key) => strippedLine.startsWith(key));

            if (isHeaderLine) {
                headerLines.push(line);
            } else {
                commentLines.push(this.cleanComment(line));
            }
        }

        return { headerLines, commentLines };
    }

    handleMissingHead(lines) {
        let headerLines = [];
        let commentLines = [];
        let inHeader = false;

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            const strippedLine = line.trim();
            line = line.replace(/={4,}|-{4,}/g, ""); // Remove lines with 4 or more '=' or '-'

            if (strippedLine.startsWith("key")) {
                break;
            }

            if (
                strippedLine.startsWith("begin_of_head") ||
                strippedLine.startsWith("modelname") ||
                strippedLine.startsWith("product_type")
            ) {
                inHeader = true;
            }

            if (strippedLine.startsWith("begin_of_head")) {
                continue;
            }

            if (inHeader && strippedLine) {
                headerLines.push(line);
            } else if (!inHeader) {
                commentLines.push(this.cleanComment(line));
            }
        }

        return { headerLines, commentLines };
    }

    cleanComment(line) {
        const trimmed = line.trim();
        if (!trimmed) {
            return '';
        }
        return `${trimmed}\n`;
    }

    parseRecords(lines) {
        const records = {};

        for (const line of lines) {
            const stripped = line.trim();

            if (stripped.startsWith("#") || !stripped) {
                continue;
            }
            // Match group 1 (\S+): The keyword
            // Match group 2 (.*): The parameters
            const match = stripped.match(/^(\S+)\s*(.*)$/);

            if (match) {
                const keyword = match[1];
                const parameters = match[2] || "";
                records[keyword] = parameters;
            }
        }

        return records;
    }
}

const gfcParser = new GFCParser();

export function validateGfcFileExtension(file) {
    gfcParser.validateGfcFileExtension(file);
}

export async function parseGfcFiles(file) {
    return gfcParser.parseGfcFiles(file);
}

export function extractSections(lines) {
    let sections = gfcParser.extractSections(lines);

    // 3.1 Handle the case when the comment is not separated from header
    if (sections.headerLines.length === 0) {
        // parse all lines
        // for each line starting with a known header key, treat as header; otherwise comment
        sections = gfcParser.extractSectionsByHeaderKeys(lines);
    }

    return sections;
}

export function parseRecords(lines) {
    return gfcParser.parseRecords(lines);
}

export { GFCParser, CSVParser, Parser };
