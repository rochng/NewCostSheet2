namespace NewCostSheet.Api.Services;

public class ImportParserService
{
    public List<List<string>> ParseClipboard(string clipboardText)
    {
        if (string.IsNullOrWhiteSpace(clipboardText))
            return new List<List<string>>();

        var rows = new List<List<string>>();
        var currentRow = new List<string>();
        var currentCell = string.Empty;
        var inQuotes = false;

        for (var i = 0; i < clipboardText.Length; i++)
        {
            var ch = clipboardText[i];
            var next = i + 1 < clipboardText.Length ? clipboardText[i + 1] : '\0';

            if (ch == '"')
            {
                if (inQuotes && next == '"')
                {
                    currentCell += '"';
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (ch == '\t' && !inQuotes)
            {
                currentRow.Add(currentCell);
                currentCell = string.Empty;
            }
            else if ((ch == '\r' || ch == '\n') && !inQuotes)
            {
                if (ch == '\r' && next == '\n')
                {
                    i++;
                }

                currentRow.Add(currentCell);
                if (currentRow.Any(c => !string.IsNullOrEmpty(c)))
                {
                    rows.Add(currentRow);
                }

                currentRow = new List<string>();
                currentCell = string.Empty;
            }
            else
            {
                currentCell += ch;
            }
        }

        if (!string.IsNullOrEmpty(currentCell) || currentRow.Count > 0)
        {
            currentRow.Add(currentCell);
            if (currentRow.Any(c => !string.IsNullOrEmpty(c)))
            {
                rows.Add(currentRow);
            }
        }

        return rows;
    }
}
