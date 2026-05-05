# Mothitor VA System — Antenna Data 2025

This is an interactive visual analytics system built with *D3.js* to explore and analyze moth data from images captured by Mothitors (moth monitors at Macleish, which are automatic antenna sensor deployments). 

The dashboard provides an interactive view of moth biodiversity, abundance, and biomass across different timeframes (months and seasons) and taxa (family, genus, and species).

## Purpose of the System

The primary goal of Mothitor VA system is to transform raw sensor detection logs into a format that enables the comparison of observation distributions between three monitoring devices.

The system allows a user to:
*   Compare diversity by evaluating taxonomic richness (Species, Genus, or Family levels) across the three different deployments: *SYD*, *AMA*, and *CAR*.
*   Observe how moth populations vary through the spring, summer, and fall seasons or across months.
*   Assess the average biomass per taxon (i.e. physical size/weight of populations), providing a deeper insight into the ecological significance than simple detection counts.
*   Isolate rare occurrences by filtering out "singletons" (taxa appearing only once) to focus on established local populations.

## How to Use the VA System

### 1. Visualization Boards
The dashboard is organized into three Mothitor Boards, one for each deployment (from left to right: small, medium, large). 
*   **Dots:** Each dot represents a specific taxon. The size of the dot correlates to the total number of detections. The taxa with the lowest biomass in the deployment are displayed on the left, while the taxa with higher biomass are displayed more on the left.
*   **Mean Line (Avg):** The dashed orange line represents the average detection count across all taxa for that specific deployment.
*   **Average Biomass:** Located under each deployment, this displays the average pixel area ($px^2$) of detections.

### 2. Interactions
*   **Taxonomic Toggle:** Switch the specificity/granularity of the data between the *Species*, *Genus*, and *Family* taxa.
*   **Time Filters:** 
    *   *By Month:* Select specific months to see month-specific data.
    *   *By Season:* Use the Spring (Apr-May), Summer (Jun-Aug), or Fall (Sep-Oct) categories for broader time windows.
*   **Singleton Filter:** Click "Hide singletons" to show only taxa with 2 or more detections.
*   **Interactive Legend:** Hover over any taxon in the legend to highlight its specific dots across all three deployment boards. This is useful for tracking a specific taxon's or species' presence across different deployments.
*   **Tooltips:** Hover over any dot in the charts to see the exact taxon name and detection count.

## Data Processing

### Data Cleaning
*   **Filtering Criteria:** Any records identified as "Not Lepidoptera" are filtered out to ensure the dashboard remains focused on moth data.
*   **Hierarchy Mapping:** The system parses the nested taxonomic "parents" array to extract the Species, Genus, and Family ranks. If a rank is missing, it is labeled as "Unknown". 
 
### Data Analysis
