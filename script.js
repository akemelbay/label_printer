$(document).ready(function () {
    const range = `${SHEET_NAME}!A1:Z`; // Adjust the range as needed
    const rangeQuantum = `${SHEET_NAME_QUANTUM}!A1:Z`; // Adjust the range as needed

    let currentSheet = range; // Variable to keep track of the current sheet

    function fetchDataAndInitializeTable(sheetRange) {
        fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${sheetRange}?key=${API_KEY}`)
            .then(response => response.json())
            .then(data => {
                const headers = data.values[0];
                const rows = data.values.slice(1);
                const tableHeader = $('#table-header');
                const tableFooter = $('#table-footer');

                tableHeader.empty();
                tableFooter.empty();

                headers.forEach(header => {
                    tableHeader.append($('<th>').text(header));
                    tableFooter.append($('<th>').html(`<input type="text" class="search-input" placeholder="${header}" />`));
                });

                if (currentSheet.includes('Sputter')) {
                    $('#currentSheet').html(`<h2>Sputter</h2>`);
                } else if (currentSheet.includes('Quantum')) {
                    $('#currentSheet').html(`<h2>Quantum</h2>`);
                }

                // Find the index of the "Material name" column
                const materialNameIndex = headers.indexOf("Material name");

                // Replace values in the "Material name" column based on the provided vocabulary
                if (materialNameIndex !== -1) {
                    rows.forEach(row => {
                        if (row[materialNameIndex]) {
                            row[materialNameIndex] = row[materialNameIndex]
                                .replace(/Titanium/g, "Ti")
                                .replace(/Tungsten/g, "W")
                                .replace(/Hafnium/g, "Hf")
                                .replace(/Silicon/g, "Si")
                                .replace(/Niobium/g, "Nb")
                                .replace(/ Nitride/g, "N")
                                .replace(/Gold/g, "Au")
                                .replace(/Aluminum/g, "Al");
                        }
                    });
                }

                const tableBody = $('#example tbody');
                tableBody.empty();

                rows.forEach(row => {
                    const tr = $('<tr>');
                    row.forEach(cell => {
                        tr.append($('<td>').text(cell));
                    });
                    tableBody.append(tr);
                });

                const columnDefs = headers.map((header, index) => {
                    if (header === "Entry date" || header === "XML file path" || header === "CSV file path") {
                        return {
                            targets: index,
                            visible: false
                        };
                    }
                    return null;
                }).filter(def => def !== null);

                const table = $('#example').DataTable({
                    "order": [
                        [0, "desc"], // First column in descending order
                        [1, "desc"] // Second column in descending order
                    ],
                    "responsive": false, // Disable responsive functionality
                    columnDefs: columnDefs,
                    "pageLength": 25, // Set default number of entries shown to 50
                    "lengthMenu": [10, 25, 50, 100], // Add items per page selector
                    "fixedHeader": true, // Enable fixed header
                    "select": {
                        "style": "multi" // Enable multiple row selection
                    },
                    "dom": '<"top"fBl>rt<"bottom"ip><"clear">', // Add lengthMenu, buttons, and other elements
                    "buttons": [
                        {
                            text: 'Create label',
                            attr: { id: 'createLabelButton' },
                            action: function (e, dt, node, config) {
                                $('#myModal').css('display', 'block');
                                updateCustomContent();
                            }
                        },
                        {
                            text: 'Sputter / Quantum',
                            attr: { id: 'toggleChamberButton' },
                            action: function (e, dt, node, config) {
                                table.destroy();
                                currentSheet = (currentSheet === range) ? rangeQuantum : range;
                                fetchDataAndInitializeTable(currentSheet);
                            }
                        }
                    ],
                    initComplete: function () {
                        this.api().columns().every(function () {
                            let column = this;
                            let input = $('input', column.footer());

                            input.on('keyup change clear', function () {
                                if (column.search() !== this.value) {
                                    column.search(this.value).draw();
                                }
                            });
                        });
                    }
                });

                let selectedRowOrder = [];

                // Track the order of selected rows
                table.on('select', function (e, dt, type, indexes) {
                    indexes.forEach(index => {
                        selectedRowOrder.push(index);
                    });
                });

                table.on('deselect', function (e, dt, type, indexes) {
                    indexes.forEach(index => {
                        selectedRowOrder = selectedRowOrder.filter(i => i !== index);
                    });
                });

                // Add checkboxes for each column in the "Custom" tab
                $('#customCheckboxes').empty();
                headers.forEach((header, index) => {
                    const isChecked = ['Date', 'Substrate name', 'Material name', 'Substrate T, C', 'DC Power max, %', 'Calibrated Rate, A/s'].includes(header) ? 'checked' : '';
                    $('#customCheckboxes').append(`
                        <div>
                            <input type="checkbox" id="checkbox${index}" name="checkbox${index}" value="${header}" ${isChecked}>
                            <label for="checkbox${index}">${header}</label>
                        </div>
                    `);
                });

                // Add event listeners for checkboxes
                $('input[type="checkbox"]').on('change', function () {
                    updateCustomContent();
                });

                function updateCustomContent() {
                    let customContent = '';
                    let addedSubstrateNames = new Set();

                    selectedRowOrder.forEach(index => {
                        const row = table.row(index).data();
                        let content = `<div class="process">`;
                        let hasContent = false;
                        let substrateNameAdded = false;

                        $('input[type="checkbox"]:checked').each(function () {
                            const columnName = $(this).val();
                            const columnValue = row[headers.indexOf(columnName)];

                            if (columnName === "Substrate name") {
                                if (!addedSubstrateNames.has(columnValue)) {
                                    addedSubstrateNames.add(columnValue);
                                    content += `<p><b><u>${columnName}:</u> </b> ${columnValue}</p>`;
                                    hasContent = true;
                                    substrateNameAdded = true;
                                }
                            } else if (columnValue && columnValue.trim() !== "") {
                                content += `<p><b>${columnName}:</b> ${columnValue}</p>`;
                                hasContent = true;
                            }
                        });

                        if (hasContent) {
                            content += `<textarea class="customNotes" placeholder="Add notes here..." rows="4"></textarea></div>`;
                            customContent += content;
                        }
                    });

                    $('#customContent').html(customContent);
                }

                // Close the modal when the user clicks on <span> (x)
                $('.close').on('click', function () {
                    $('#myModal').css('display', 'none');
                });

                // Close the modal when the user clicks anywhere outside of the modal
                $(window).on('click', function (event) {
                    if (event.target.id === 'myModal') {
                        $('#myModal').css('display', 'none');
                    }
                });

                // Print button functionality
                $('#printButton').on('click', function () {
                    // Convert textarea text to div and hide textarea for those that have text
                    $('#label .customNotes').each(function () {
                        if ($(this).val().trim() !== '') {
                            const text = $(this).val();
                            let addNoteLabel = '';
                            if (selectedRowOrder.length > 0) {
                                addNoteLabel = '<b>Note:</b> ';
                            }
                            const div = $('<div>').html(addNoteLabel + text).css({
                                'white-space': 'pre-wrap',
                                'overflow': 'hidden',
                                'border': 'none',
                                'padding': '0',
                                'font-family': 'Time',
                                'font-size': '12px',
                                'width': $(this).width(),
                            });
                            $(this).after(div).hide();
                        } else {
                            // Hide empty textareas
                            $(this).css('display', 'none');
                        }
                    });
                    // Remove border before printing
                    $('#label').css('border', 'none')

                    function printLabel() {
                        const labelContent = document.querySelector("#label").innerHTML;
                        const printWindow = window.open('', '_blank');
                        printWindow.document.write('<html><head><title>Print</title>');
                        printWindow.document.write('<style>#label-print {width: 6cm;font-size:12px;font-family:Time;padding:5px;background-color:white;border:0;overflow:hidden;overflow-wrap: break-word;}#customContent p {margin:0;} .process {border-bottom: 1px dashed black;margin-bottom: 5px;padding-bottom: 5px;}</style>');
                        printWindow.document.write('</head><body>');
                        printWindow.document.write('<div id="label-print">' + labelContent + '</div>');
                        printWindow.document.write('</body></html>');
                        printWindow.document.close();
                        printWindow.print();
                        printWindow.close();

                        // Remove the created div and show textarea again
                        document.querySelectorAll('#label .customNotes').forEach(function (element) {
                            if (element.nextElementSibling) {
                                element.nextElementSibling.remove();
                                element.style.display = 'block';
                            } else {
                                // Show empty textareas again
                                element.style.display = 'block';
                                // Show border again
                                document.querySelector('#label').style.border = '2px solid black';
                            }
                        });
                    }
                    printLabel()
                });

                // Generate anchor elements for all columns
                $('#toggleLinksContainer').empty();
                headers.forEach((header, index) => {
                    const toggleLink = `<a href="#" class="toggle-vis" data-column="${index}">${header}</a>`;
                    $('#toggleLinksContainer').append(toggleLink);
                });

                // Add event listeners for dynamically generated anchor elements
                document.querySelectorAll('a.toggle-vis').forEach((el) => {
                    el.addEventListener('click', function (e) {
                        e.preventDefault();

                        let columnIdx = e.target.getAttribute('data-column');
                        let column = table.column(columnIdx);

                        // Toggle the visibility
                        column.visible(!column.visible());
                    });
                });
            })
            .catch(error => console.error('Error fetching data:', error));
    }

    // Initialize the table with the default sheet
    fetchDataAndInitializeTable(range);
});