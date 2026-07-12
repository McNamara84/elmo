class Parser {

    checkFile(file) {
        // Instead of mutating instance state (this.fileName), 
        // it's safer to just return the data you need.
        const fileName = file.name;
        const fileExtension = fileName.split('.').pop().toLowerCase();
        return { name: fileName, extension: fileExtension };
    }
    // stri
    limitFileSize(file, maxSizeInMB, strict = true) {
        if (file.size > maxSizeInMB * 1024 * 1024) {
            if (strict) {
                throw new Error(`File size exceeds the limit of ${maxSizeInMB} MB.`);
            } else {
                return false;
            }
        }
        return true;
    }

    // Return a Promise instead of taking a callback
    readFile(file) {
        return new Promise((resolve, reject) => {
            // Create a NEW reader per file to avoid shared-state bugs
            const reader = new FileReader();
            
            // Resolve the promise when successful
            reader.onload = (event) => resolve(event.target.result);
            
            // Reject the promise on failure
            reader.onerror = (event) => reject(new Error(`Error reading file: ${event.target.error}`));
            
            reader.readAsText(file);
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
        // We pause execution here until the Promise resolves
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

    /**
     * Main method to read and parse the GFC file.
     * Assumes `this.readFile(file)` returns a Promise (as updated previously).
     * 
     * @param {File} file - The file object from an HTML input
     */
    async parse(file) {
        try {
            // 1. Read the file contents as text
            const text = await this.readFile(file);
            
            // 2. Split the text into an array of lines (handling both \r\n and \n)
            const lines = text.split(/\r?\n/);
            
            // 3. Extract the sections
            const { headerLines, commentLines } = this.extractSections(lines);
            
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
            const line = lines[i];
            const strippedLine = line.trim();

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

    handleMissingHead(lines) {
        let headerLines = [];
        let commentLines = [];
        
        // Regex: starts with 1+ word characters, followed by 3+ spaces
        const headerPattern = /^\w+\s{3,}/;

        for (const line of lines) {
            const strippedLine = line.trim();

            if (strippedLine.startsWith("key")) {
                break;
            }

            if (headerPattern.test(strippedLine)) {
                headerLines.push(line);
            } else {
                commentLines.push(this.cleanComment(line));
            }
        }

        return { headerLines, commentLines };
    }

    parseRecords(lines) {
        const records = {};

        for (const line of lines) {
            const stripped = line.trim();
            
            if (stripped.startsWith("#") || !stripped) {
                continue;
            }

            // JavaScript doesn't have Python's `split(maxsplit=1)`.
            // Instead, we use a regex to capture the first word, and everything after it.
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

    retrieveDOIs(comment) {
        // Regex to find DOIs with the global flag 'g' to find all matches
        const doiPattern = /\b(?:https:\/\/doi\.org\/|doi)\S+/g;
        const matches = comment.match(doiPattern) || [];
        
        // Clean up trailing punctuation (JS equivalent of rstrip)
        const cleanedDois = matches.map(doi => doi.replace(/[.)!/]+$/, ''));
        
        // Format into XML-like strings
        const doisTags = cleanedDois.map(doi => `<DOI>${doi}</DOI>`).join("");
        
        return `<DOIs>${doisTags}</DOIs>`;
    }

    cleanComment(comment) {
        // Remove structural dividers
        let cleaned = comment.replace(/(===+|---+|\*\*\*+)/g, '');
        // Replace commas with semicolons
        cleaned = cleaned.replace(/,/g, ';');
        
        return cleaned;
    }
}